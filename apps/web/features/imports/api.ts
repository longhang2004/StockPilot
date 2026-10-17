import type {
  ImportCommitResult,
  ImportPreviewResult,
} from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';

/** CSV preview payload (the schema is API-local; the web form owns it). */
export interface ImportPreviewInput {
  content: string;
  fileName: string;
}

export function previewImport(
  input: ImportPreviewInput,
): Promise<ImportPreviewResult> {
  return apiRequest<ImportPreviewResult>('/product-imports/preview', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function commitImport(
  id: string,
  idempotencyKey: string,
): Promise<ImportCommitResult> {
  return apiRequest(`/product-imports/${id}/commit`, {
    idempotencyKey,
    method: 'POST',
  });
}
