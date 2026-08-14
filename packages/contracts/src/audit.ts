import { z } from 'zod';

import { DateTimeSchema, PageShapeSchema, UuidSchema } from './common.js';

/**
 * Audit event returned by GET /v1/audit-events. The API serializes raw rows
 * with the actor's display name; before/after are JSONB snapshots.
 */
export const AuditRecordSchema = z.object({
  id: UuidSchema,
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  createdAt: DateTimeSchema,
  actor: z.object({ displayName: z.string() }).nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

export const AuditListSchema = PageShapeSchema.extend({
  items: z.array(AuditRecordSchema),
});
export type AuditList = z.infer<typeof AuditListSchema>;
