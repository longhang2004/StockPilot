import { z } from 'zod';

import { DateTimeSchema, PageShapeSchema, UuidSchema } from './common.js';

export const IntegrationDeliveryStatusSchema = z.enum([
  'RECEIVED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
]);
export type IntegrationDeliveryStatus = z.infer<
  typeof IntegrationDeliveryStatusSchema
>;

/**
 * Integration delivery record returned by GET /v1/integration-deliveries.
 * The API serializes raw rows; this contract documents the fields the
 * integrations workspace consumes. `salesOrderId` links a SUCCEEDED
 * delivery to the sales order it created (UX-06).
 */
export const IntegrationDeliveryRecordSchema = z.object({
  id: UuidSchema,
  externalDeliveryId: z.string(),
  eventType: z.string(),
  status: IntegrationDeliveryStatusSchema,
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  payload: z.unknown(),
  salesOrderId: UuidSchema.nullable(),
  createdAt: DateTimeSchema,
  processedAt: DateTimeSchema.nullable(),
});
export type IntegrationDeliveryRecord = z.infer<
  typeof IntegrationDeliveryRecordSchema
>;

export const IntegrationDeliveryListSchema = PageShapeSchema.extend({
  items: z.array(IntegrationDeliveryRecordSchema),
});
export type IntegrationDeliveryList = z.infer<
  typeof IntegrationDeliveryListSchema
>;
