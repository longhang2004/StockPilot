import type { OrderStatus } from '@stockpilot/contracts';

const transitions: Readonly<Record<OrderStatus, ReadonlySet<OrderStatus>>> = {
  CANCELLED: new Set(),
  CONFIRMED: new Set(['CANCELLED', 'FULFILLED']),
  DRAFT: new Set(['CANCELLED', 'CONFIRMED']),
  FULFILLED: new Set(),
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].has(to);
}

export function invalidTransitionMessage(
  from: OrderStatus,
  to: OrderStatus,
): string {
  return `Sales order cannot transition from ${from} to ${to}.`;
}
