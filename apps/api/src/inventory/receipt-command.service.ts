import { NotFoundException } from '@nestjs/common';
import type { ReceiptInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import { projectInventory } from './inventory-projection.js';
import type { InventoryReconciliationService } from './inventory-reconciliation.service.js';
import { lockInventoryBalance } from './inventory-locks.js';

export async function applyReceiptTransaction(
  transaction: Prisma.TransactionClient,
  reconciliation: InventoryReconciliationService,
  auth: AuthContext,
  organizationId: string,
  input: ReceiptInput,
) {
  const warehouse = await transaction.warehouse.findUnique({
    where: { organizationId },
  });
  if (!warehouse) throw new NotFoundException('Warehouse not found.');
  const supplier = await transaction.supplier.findFirst({
    select: { id: true },
    where: { id: input.supplierId, isActive: true, organizationId },
  });
  if (!supplier) throw new NotFoundException('Active supplier not found.');

  const productIds = input.lines.map((line) => line.productId).sort();
  const products = await transaction.product.findMany({
    select: { id: true, reorderPoint: true },
    where: { id: { in: productIds }, isActive: true, organizationId },
  });
  if (products.length !== productIds.length) {
    throw new NotFoundException('One or more active products were not found.');
  }
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );

  const receipt = await transaction.goodsReceipt.create({
    data: {
      actorUserId: auth.user.id,
      note: input.note,
      organizationId,
      receiptNumber: input.receiptNumber,
      receivedAt: new Date(input.receivedAt),
      supplierId: input.supplierId,
      warehouseId: warehouse.id,
    },
  });
  const lines = [];
  const balances = [];
  const beforeBalances = [];
  for (const line of [...input.lines].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  )) {
    const product = productsById.get(line.productId);
    if (!product) throw new NotFoundException('Active product not found.');
    const current = await lockInventoryBalance(
      transaction,
      organizationId,
      warehouse.id,
      line.productId,
    );
    beforeBalances.push({
      available: current.onHand - current.reserved,
      onHand: current.onHand,
      productId: line.productId,
      reserved: current.reserved,
    });
    const next = projectInventory(current, { onHandDelta: line.quantity });
    const balance = await transaction.inventoryBalance.update({
      data: { onHand: next.onHand, version: { increment: 1 } },
      where: { id: current.id },
    });
    const receiptLine = await transaction.goodsReceiptLine.create({
      data: {
        goodsReceiptId: receipt.id,
        organizationId,
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      },
    });
    await transaction.stockMovement.create({
      data: {
        actorUserId: auth.user.id,
        onHandAfter: next.onHand,
        organizationId,
        productId: line.productId,
        quantityDelta: line.quantity,
        referenceId: receipt.id,
        referenceType: 'GOODS_RECEIPT',
        type: 'RECEIPT',
        warehouseId: warehouse.id,
      },
    });
    await reconciliation.reconcileBalance(transaction, {
      available: next.available,
      organizationId,
      productId: line.productId,
      reorderPoint: product.reorderPoint,
      warehouseId: warehouse.id,
    });
    lines.push({
      ...receiptLine,
      unitCost: receiptLine.unitCost?.toFixed(2) ?? null,
    });
    balances.push({
      available: next.available,
      onHand: balance.onHand,
      productId: balance.productId,
      reserved: balance.reserved,
    });
  }

  await recordAudit(transaction, {
    action: 'RECEIPT_APPLIED',
    actorUserId: auth.user.id,
    after: { balances, lines, receiptNumber: receipt.receiptNumber },
    before: { balances: beforeBalances },
    entityId: receipt.id,
    entityType: 'GoodsReceipt',
    organizationId,
  });

  return { ...receipt, balances, lines };
}
