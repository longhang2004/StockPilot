import type {
  AdjustmentResult,
  InventoryProductTrace,
  InventoryAdjustmentInput,
} from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';

export const BALANCES_RESOURCE = '/inventory/balances';
export const ALERTS_RESOURCE = '/alerts';

export function fetchProductTrace(
  id: string,
  params: { reservationsPage: number; movementsPage: number },
): Promise<InventoryProductTrace> {
  const query = new URLSearchParams({
    reservationsPage: String(params.reservationsPage),
    reservationsPageSize: '10',
    movementsPage: String(params.movementsPage),
    movementsPageSize: '10',
  });
  return apiRequest<InventoryProductTrace>(
    `/inventory/products/${encodeURIComponent(id)}/trace?${query.toString()}`,
  );
}

export function createAdjustment(
  value: InventoryAdjustmentInput,
  idempotencyKey: string,
): Promise<AdjustmentResult> {
  return apiRequest<AdjustmentResult>('/inventory/adjustments', {
    body: JSON.stringify(value),
    idempotencyKey,
    method: 'POST',
  });
}
