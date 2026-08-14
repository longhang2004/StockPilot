import { z } from 'zod';

import {
  IdentifierSchema,
  IdempotencyKeySchema,
} from '../validation/common-schemas.js';

export const InventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const AlertListQuerySchema = InventoryListQuerySchema.extend({
  status: z.enum(['OPEN', 'RESOLVED']).default('OPEN'),
});

export { IdentifierSchema, IdempotencyKeySchema };
