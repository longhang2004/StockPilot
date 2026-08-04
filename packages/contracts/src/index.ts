import { z } from 'zod';

export const RoleSchema = z.enum(['OWNER', 'MANAGER', 'STAFF']);
export type Role = z.infer<typeof RoleSchema>;

export const OrderStatusSchema = z.enum([
  'DRAFT',
  'CONFIRMED',
  'FULFILLED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const StockMovementTypeSchema = z.enum([
  'RECEIPT',
  'SALE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
]);
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

export const IntegrationDeliveryStatusSchema = z.enum([
  'RECEIVED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
]);
export type IntegrationDeliveryStatus = z.infer<
  typeof IntegrationDeliveryStatusSchema
>;

export const ProblemDetailsSchema = z.object({
  type: z.url(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1),
  instance: z.string().min(1),
  code: z.string().min(1),
  traceId: z.string().min(1),
  errors: z
    .array(
      z.object({
        field: z.string().min(1).optional(),
        message: z.string().min(1),
      }),
    )
    .optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
