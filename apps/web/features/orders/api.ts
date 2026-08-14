import type { SalesOrderInput } from '@stockpilot/contracts';

import { apiRequest, newIdempotencyKey } from '../../lib/api-client';
import type { OrderDetail } from '../shared/types';

export const ORDERS_RESOURCE = '/orders';

/** Structured query keys for order state (list keys live in usePage). */
export const orderKeys = {
  detail: (id: string) => ['order', id] as const,
};

export function fetchOrderDetail(id: string): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(`/orders/${id}`);
}

export function createDraftOrder(value: SalesOrderInput): Promise<OrderDetail> {
  return apiRequest<OrderDetail>('/orders', {
    body: JSON.stringify(value),
    method: 'POST',
  });
}

const transitionPathByStatus = {
  CANCELLED: 'cancel',
  CONFIRMED: 'confirm',
  FULFILLED: 'fulfill',
} as const;

export type OrderTransitionTarget = keyof typeof transitionPathByStatus;

export function transitionOrder(
  id: string,
  to: OrderTransitionTarget,
): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(
    `/orders/${id}/${transitionPathByStatus[to]}`,
    {
      idempotencyKey: newIdempotencyKey(`order-${to.toLowerCase()}`),
      method: 'POST',
    },
  );
}
