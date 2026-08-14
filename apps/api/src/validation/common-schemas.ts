import { z } from 'zod';

/** UUID path/body identifier shared by catalog, orders, inventory, imports. */
export const IdentifierSchema = z.uuid();

/**
 * Idempotency-Key header format shared by every idempotent command
 * (receipts, adjustments, order transitions, import commit, integration
 * retry, demo reset). Runtime validation lives here; the OpenAPI projection
 * imports this same schema.
 */
export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/);
