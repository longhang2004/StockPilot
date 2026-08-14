import { z } from 'zod';

/** UUID identifier used across shared response schemas. */
export const UuidSchema = z.uuid();

/** ISO-8601 timestamp as produced by JSON serialization of a Date. */
export const DateTimeSchema = z.iso.datetime();

/**
 * Decimal money as a two-decimal string — the wire shape for every money
 * field (Prisma Decimal columns are serialized with `.toFixed(2)`).
 */
export const MoneyStringSchema = z
  .string()
  .regex(/^\d+\.\d{2}$/)
  .describe('Decimal money as a two-decimal string.');

/** Money accepted in request inputs: two-decimal string, non-negative. */
export const MoneySchema = z
  .string()
  .regex(/^\d{1,10}\.\d{2}$/)
  .refine((value) => Number(value) >= 0, 'Money cannot be negative.');

export const OptionalContactSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .nullable()
  .optional()
  .default(null);

export const OptionalEmailSchema = z
  .email()
  .max(320)
  .nullable()
  .optional()
  .default(null);

export const OptionalPhoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(40)
  .nullable()
  .optional()
  .default(null);

/** Pagination envelope shared by every list endpoint. */
export const PageShapeSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

/** Type of a paginated list response: `PageShapeSchema` plus `items`. */
export type PageResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
