import { z } from 'zod';

import { DateTimeSchema, UuidSchema } from './common.js';

/** Row-level CSV validation error. */
export const ImportErrorSchema = z.object({
  row: z.number().int(),
  field: z.string().optional(),
  message: z.string(),
});
export type ImportError = z.infer<typeof ImportErrorSchema>;

/**
 * Body returned by POST /v1/product-imports/preview and embedded as `run`
 * in the commit result. Mirrors `serializeRun` in the API's
 * product-csv-serializer.
 */
export const ImportPreviewResultSchema = z.object({
  createdAt: DateTimeSchema,
  errors: z.array(ImportErrorSchema),
  fileName: z.string(),
  id: UuidSchema,
  rowsInvalid: z.number().int(),
  rowsTotal: z.number().int(),
  rowsValid: z.number().int(),
  status: z.string(),
});
export type ImportPreviewResult = z.infer<typeof ImportPreviewResultSchema>;

/** Body returned by POST /v1/product-imports/:id/commit. */
export const ImportCommitResultSchema = z.object({
  created: z.number().int(),
  run: ImportPreviewResultSchema,
});
export type ImportCommitResult = z.infer<typeof ImportCommitResultSchema>;
