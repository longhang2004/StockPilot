import { z } from 'zod';

import {
  IdentifierSchema,
  IdempotencyKeySchema,
} from '../validation/common-schemas.js';

export const ImportPreviewInputSchema = z.object({
  content: z.string(),
  fileName: z.string().trim().min(1).max(255),
});

export { IdentifierSchema, IdempotencyKeySchema };
