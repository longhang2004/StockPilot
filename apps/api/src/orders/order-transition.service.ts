import { ConflictException, NotFoundException } from '@nestjs/common';
import type { OrderStatus } from '@stockpilot/contracts';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  InventoryInvariantError,
  projectInventory,
} from '../inventory/inventory-projection.js';
import type { InventoryReconciliationService } from '../inventory/inventory-reconciliation.service.js';
import { findOrderDetail } from './order-query.service.js';
import {
  canTransition,
  invalidTransitionMessage,
} from './order-state-machine.js';

export async function transitionOrder(
  transaction: Prisma.TransactionClient,
  reconciliation: InventoryReconciliationService,
  auth: AuthContext,
  id: string,
  to: Exclude<OrderStatus, 'DRAFT'>,
) {
  const organizationId = requireMembership(auth).organization.id;
  const locked = await transaction.$queryRaw<
    Array<{ id: string; status: OrderStatus }>
  >`
    SELECT "id", "status"::text
    FROM "sales_orders"
    WHERE "organization_id" = ${organizationId}::uuid
      AND "id" = ${id}::uuid
    FOR UPDATE
  `;
  const current = locked[0];
  if (!current) throw new NotFoundException('Sales order not found.');
  if (!canTransition(current.status, to)) {
    throw new ConflictException(invalidTransitionMessage(current.status, to));
  }
  const order = await transaction.salesOrder.findUnique({
    include: { lines: true },
    where: { id },
  });
  if (!order) throw new NotFoundException('Sales order not found.');

  const lines = [...order.lines].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  );
  if (to === 'CONFIRMED') {
    for (const line of lines) {
      const balance = await lockOrderBalance(
        transaction,
        order.organizationId,
        order.warehouseId,
        line.productId,
      );
      if (balance.onHand - balance.reserved < line.quantity) {
        throw new ConflictException(
          `Insufficient available stock for ${line.skuSnapshot}.`,
        );
      }
      await transaction.inventoryBalance.update({
        data: {
          reserved: { increment: line.quantity },
          version: { increment: 1 },
        },
        where: { id: balance.id },
      });
      await reconciliation.reconcileBalance(transaction, {
        available: balance.onHand - balance.reserved - line.quantity,
        organizationId: order.organizationId,
        productId: line.productId,
        reorderPoint: balance.reorderPoint,
        warehouseId: order.warehouseId,
      });
    }
  }
  if (to === 'FULFILLED') {
    for (const line of lines) {
      const balance = await lockOrderBalance(
        transaction,
        order.organizationId,
        order.warehouseId,
        line.productId,
      );
      let next;
      try {
        next = projectInventory(balance, {
          onHandDelta: -line.quantity,
          reservedDelta: -line.quantity,
        });
      } catch (error) {
        if (error instanceof InventoryInvariantError) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
      await transaction.inventoryBalance.update({
        data: {
          onHand: next.onHand,
          reserved: next.reserved,
          version: { increment: 1 },
        },
        where: { id: balance.id },
      });
      await reconciliation.reconcileBalance(transaction, {
        available: next.available,
        organizationId: order.organizationId,
        productId: line.productId,
        reorderPoint: balance.reorderPoint,
        warehouseId: order.warehouseId,
      });
      await transaction.stockMovement.create({
        data: {
          actorUserId: auth.user.id,
          onHandAfter: next.onHand,
          organizationId: order.organizationId,
          productId: line.productId,
          quantityDelta: -line.quantity,
          referenceId: order.id,
          referenceType: 'SALES_ORDER',
          type: 'SALE',
          warehouseId: order.warehouseId,
        },
      });
    }
  }
  if (to === 'CANCELLED' && current.status === 'CONFIRMED') {
    for (const line of lines) {
      const balance = await lockOrderBalance(
        transaction,
        order.organizationId,
        order.warehouseId,
        line.productId,
      );
      let next;
      try {
        next = projectInventory(balance, { reservedDelta: -line.quantity });
      } catch (error) {
        if (error instanceof InventoryInvariantError) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
      await transaction.inventoryBalance.update({
        data: { reserved: next.reserved, version: { increment: 1 } },
        where: { id: balance.id },
      });
      await reconciliation.reconcileBalance(transaction, {
        available: next.available,
        organizationId: order.organizationId,
        productId: line.productId,
        reorderPoint: balance.reorderPoint,
        warehouseId: order.warehouseId,
      });
    }
  }

  const now = new Date();
  const updateData: Prisma.SalesOrderUpdateInput = { status: to };
  if (to === 'CANCELLED') updateData.cancelledAt = now;
  if (to === 'CONFIRMED') updateData.confirmedAt = now;
  if (to === 'FULFILLED') updateData.fulfilledAt = now;
  await transaction.salesOrder.update({ data: updateData, where: { id } });
  await transaction.orderTransition.create({
    data: {
      actorUserId: auth.user.id,
      fromStatus: current.status,
      organizationId: order.organizationId,
      salesOrderId: order.id,
      toStatus: to,
    },
  });
  await recordAudit(transaction, {
    action: `ORDER_${to}`,
    actorUserId: auth.user.id,
    after: { fromStatus: current.status, toStatus: to },
    before: { status: current.status },
    entityId: order.id,
    entityType: 'SalesOrder',
    organizationId: order.organizationId,
  });
  return findOrderDetail(transaction, order.organizationId, order.id);
}

async function lockOrderBalance(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  warehouseId: string,
  productId: string,
) {
  const rows = await transaction.$queryRaw<
    Array<{
      id: string;
      on_hand: number;
      reserved: number;
      reorder_point: number;
    }>
  >`
    SELECT ib."id", ib."on_hand", ib."reserved", p."reorder_point"
    FROM "inventory_balances" ib
    INNER JOIN "products" p
      ON p."organization_id" = ib."organization_id"
     AND p."id" = ib."product_id"
    WHERE ib."organization_id" = ${organizationId}::uuid
      AND ib."warehouse_id" = ${warehouseId}::uuid
      AND ib."product_id" = ${productId}::uuid
    FOR UPDATE OF ib
  `;
  const row = rows[0];
  if (!row) {
    throw new ConflictException(
      'No inventory balance exists for this product.',
    );
  }
  return {
    id: row.id,
    onHand: row.on_hand,
    reorderPoint: row.reorder_point,
    reserved: row.reserved,
  };
}
