import type {
  ReceiptDetail,
  ReceiptInput,
  ReceiptResult,
} from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';

/** Receipt history is shown from the movement ledger. */
export const RECEIPTS_RESOURCE = '/receipts';

export function fetchReceipt(id: string): Promise<ReceiptDetail> {
  return apiRequest<ReceiptDetail>(
    `${RECEIPTS_RESOURCE}/${encodeURIComponent(id)}`,
  );
}

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
