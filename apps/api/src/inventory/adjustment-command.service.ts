import { ConflictException, NotFoundException } from '@nestjs/common';
import type { InventoryAdjustmentInput } from '@stockpilot/contracts';
import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  InventoryInvariantError,
  projectInventory,
} from './inventory-projection.js';
import type { InventoryReconciliationService } from './inventory-reconciliation.service.js';
import { lockInventoryBalance } from './inventory-locks.js';

export async function adjustTransaction(
  transaction: Prisma.TransactionClient,
  reconciliation: InventoryReconciliationService,
  auth: AuthContext,
  organizationId: string,
  input: InventoryAdjustmentInput,
) {
  const [warehouse, product] = await Promise.all([
    transaction.warehouse.findUnique({ where: { organizationId } }),
    transaction.product.findFirst({
      select: { id: true, reorderPoint: true },
      where: { id: input.productId, isActive: true, organizationId },
    }),
  ]);
  if (!warehouse) throw new NotFoundException('Warehouse not found.');
  if (!product) throw new NotFoundException('Active product not found.');

  const current = await lockInventoryBalance(
    transaction,
    organizationId,
    warehouse.id,
    product.id,
  );
  const quantityDelta =
    input.type === 'ADJUSTMENT_IN' ? input.quantity : -input.quantity;
  let next;
  try {
    next = projectInventory(current, { onHandDelta: quantityDelta });
  } catch (error) {
    if (error instanceof InventoryInvariantError) {
      throw new ConflictException(error.message);
    }
    throw error;
  }

  const movementId = randomUUID();
  const beforeBalance = {
    available: current.onHand - current.reserved,
    onHand: current.onHand,
    productId: product.id,
    reserved: current.reserved,
  };
  const balance = await transaction.inventoryBalance.update({
    data: { onHand: next.onHand, version: { increment: 1 } },
    where: { id: current.id },
  });
  const movement = await transaction.stockMovement.create({
    data: {
      actorUserId: auth.user.id,
      id: movementId,
      onHandAfter: next.onHand,
      organizationId,
      productId: product.id,
      quantityDelta,
      reason: input.reason,
      referenceId: movementId,
      referenceType: 'INVENTORY_ADJUSTMENT',
      type: input.type,
      warehouseId: warehouse.id,
    },
  });
  await reconciliation.reconcileBalance(transaction, {
    available: next.available,
    organizationId,
    productId: product.id,
    reorderPoint: product.reorderPoint,
    warehouseId: warehouse.id,
  });

  await recordAudit(transaction, {
    action: 'INVENTORY_ADJUSTED',
    actorUserId: auth.user.id,
    after: {
      balance: {
        available: next.available,
        onHand: balance.onHand,
        productId: balance.productId,
        reserved: balance.reserved,
      },
      movementId,
      type: input.type,
    },
    before: { balance: beforeBalance },
    entityId: movement.id,
    entityType: 'StockMovement',
    organizationId,
  });

  return {
    balance: {
      available: next.available,
      onHand: balance.onHand,
      productId: balance.productId,
      reserved: balance.reserved,
    },
    movement,
  };
}
