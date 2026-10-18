import type { SalesOrderInput } from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';
import type {
  OrderDetail,
  PartnerRecord,
  ProductRecord,
} from '../shared/types';

export const ORDERS_RESOURCE = '/orders';

/** Structured query keys for order state (list keys live in usePage). */
export const orderKeys = {
  detail: (id: string) => ['order', id] as const,
};

export function fetchOrderDetail(id: string): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(`/orders/${id}`);
}

export function fetchOrderCustomer(id: string): Promise<PartnerRecord> {
  return apiRequest<PartnerRecord>(`/customers/${encodeURIComponent(id)}`);
}

export function fetchOrderProduct(id: string): Promise<ProductRecord> {
  return apiRequest<ProductRecord>(`/products/${encodeURIComponent(id)}`);
}

export function createDraftOrder(
  value: SalesOrderInput,
  idempotencyKey: string,
): Promise<OrderDetail> {
  return apiRequest<OrderDetail>('/orders', {
    body: JSON.stringify(value),
    idempotencyKey,
    method: 'POST',
  });
}

export function updateDraftOrder(
  id: string,
  value: SalesOrderInput,
): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(`/orders/${encodeURIComponent(id)}`, {
    body: JSON.stringify(value),
    method: 'PATCH',
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
  idempotencyKey: string,
): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(
    `/orders/${id}/${transitionPathByStatus[to]}`,
    {
      idempotencyKey,
      method: 'POST',
    },
  );
}
