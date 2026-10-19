import { NotFoundException } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { page, serializeLine, serializeOrder } from './order-mapper.js';
import type { OrderListQuery } from './orders.types.js';

export async function listOrders(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: OrderListQuery,
) {
  const where: Prisma.SalesOrderWhereInput = { organizationId };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: 'insensitive' } },
      {
        customerCompanyName: {
          contains: query.search,
          mode: 'insensitive',
        },
      },
    ];
  }
  const [items, total] = await Promise.all([
    transaction.salesOrder.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.salesOrder.count({ where }),
  ]);
  return page(items.map(serializeOrder), total, query);
}

export async function findOrderDetail(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  id: string,
) {
  const order = await transaction.salesOrder.findFirst({
    include: {
      lines: { orderBy: [{ id: 'asc' }] },
      // Display name only; the IDs stay in the response contract (UX-05).
      warehouse: { select: { name: true } },
      transitions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
    where: { id, organizationId },
  });
  if (!order) throw new NotFoundException('Sales order not found.');
  // Single bounded lookup for the creator's display name; no N+1 because
  // only this one order request path resolves it.
  const creatorMembership = await transaction.membership.findFirst({
    select: { user: { select: { displayName: true } } },
    where: {
      organizationId,
      userId: order.createdByUserId,
    },
  });
  const { warehouse, ...orderScalars } = order;
  return {
    ...serializeOrder(orderScalars),
    createdByName: creatorMembership?.user.displayName ?? null,
    lines: order.lines.map(serializeLine),
    transitions: order.transitions,
    warehouseName: warehouse?.name ?? null,
  };
}
