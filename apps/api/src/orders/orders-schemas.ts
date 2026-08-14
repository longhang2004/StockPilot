import { z } from 'zod';

import {
  IdentifierSchema,
  IdempotencyKeySchema,
} from '../validation/common-schemas.js';

export const OrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional().default(''),
  status: z.enum(['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED']).optional(),
});

export { IdentifierSchema, IdempotencyKeySchema };
