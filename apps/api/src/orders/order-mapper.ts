import type { OrderListQuery } from './orders.types.js';

export function serializeOrder(order: {
  subtotal: { toFixed: (digits: number) => string };
  [key: string]: unknown;
}) {
  return { ...order, subtotal: order.subtotal.toFixed(2) };
}

export function serializeLine(line: {
  unitPrice: { toFixed: (digits: number) => string };
  lineTotal: { toFixed: (digits: number) => string };
  [key: string]: unknown;
}) {
  return {
    ...line,
    lineTotal: line.lineTotal.toFixed(2),
    unitPrice: line.unitPrice.toFixed(2),
  };
}

export function page<T>(items: T[], total: number, query: OrderListQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}
