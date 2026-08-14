import type {
  AdjustmentResult,
  InventoryAdjustmentInput,
} from '@stockpilot/contracts';

import { apiRequest, newIdempotencyKey } from '../../lib/api-client';

export const BALANCES_RESOURCE = '/inventory/balances';
export const ALERTS_RESOURCE = '/alerts';

export function createAdjustment(
  value: InventoryAdjustmentInput,
): Promise<AdjustmentResult> {
  return apiRequest<AdjustmentResult>('/inventory/adjustments', {
    body: JSON.stringify(value),
    idempotencyKey: newIdempotencyKey('adjustment'),
    method: 'POST',
  });
}
