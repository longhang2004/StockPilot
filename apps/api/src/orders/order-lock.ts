import { NotFoundException } from '@nestjs/common';
import type { OrderStatus } from '@stockpilot/contracts';

import type { Prisma } from '../generated/prisma/client.js';

export async function lockOrder(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  id: string,
) {
  const rows = await transaction.$queryRaw<
    Array<{ id: string; status: OrderStatus }>
  >`
    SELECT "id", "status"::text
    FROM "sales_orders"
    WHERE "organization_id" = ${organizationId}::uuid
      AND "id" = ${id}::uuid
    FOR UPDATE
  `;
  const order = rows[0];
  if (!order) throw new NotFoundException('Sales order not found.');
  return order;
}
