import { CustomerInputSchema, ProductInputSchema } from '@stockpilot/contracts';
import { z } from 'zod';

import { IdentifierSchema } from '../validation/common-schemas.js';

/** Pagination/search query shared by products, customers, and suppliers. */
export const CatalogListQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional().default(''),
});

/**
 * Partial product update. Runtime rejects an empty payload via `.refine`;
 * the OpenAPI projection carries the closest structural constraint
 * (`minProperties: 1`) because Zod refinements are not representable in
 * OpenAPI — the semantic difference is documented in `openapi/schemas.ts`.
 */
export const ProductUpdateSchema = ProductInputSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'No changes supplied.');

export const PartnerUpdateSchema = CustomerInputSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'No changes supplied.');

export { IdentifierSchema };
