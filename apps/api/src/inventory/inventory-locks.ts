import { ConflictException } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';

export interface LockedBalance {
  id: string;
  onHand: number;
  reserved: number;
}

export async function lockInventoryBalance(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  warehouseId: string,
  productId: string,
): Promise<LockedBalance> {
  await transaction.inventoryBalance.upsert({
    create: { organizationId, productId, warehouseId },
    update: {},
    where: {
      organizationId_warehouseId_productId: {
        organizationId,
        productId,
        warehouseId,
      },
    },
  });
  const rows = await transaction.$queryRaw<
    Array<{
      id: string;
      on_hand: number;
      reserved: number;
    }>
  >`
    SELECT "id", "on_hand", "reserved"
    FROM "inventory_balances"
    WHERE "organization_id" = ${organizationId}::uuid
      AND "warehouse_id" = ${warehouseId}::uuid
      AND "product_id" = ${productId}::uuid
    FOR UPDATE
  `;
  const balance = rows[0];
  if (!balance) {
    throw new ConflictException('Inventory balance could not be locked.');
  }
  return {
    id: balance.id,
    onHand: balance.on_hand,
    reserved: balance.reserved,
  };
}
