import type { ReceiptInput, ReceiptResult } from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';

/** Receipt history is shown from the movement ledger. */
export const MOVEMENTS_RESOURCE = '/inventory/movements';

export function createReceipt(
  value: ReceiptInput,
  idempotencyKey: string,
): Promise<ReceiptResult> {
  return apiRequest<ReceiptResult>('/receipts', {
    body: JSON.stringify(value),
    idempotencyKey,
    method: 'POST',
  });
}
