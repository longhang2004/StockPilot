import type {
  AdjustmentResult,
  InventoryAdjustmentInput,
} from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';

export const BALANCES_RESOURCE = '/inventory/balances';
export const ALERTS_RESOURCE = '/alerts';

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
