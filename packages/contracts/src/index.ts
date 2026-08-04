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

const OptionalContactSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .nullable()
  .optional()
  .default(null);

const OptionalEmailSchema = z
  .email()
  .max(320)
  .nullable()
  .optional()
  .default(null);

const OptionalPhoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(40)
  .nullable()
  .optional()
  .default(null);

export const ProductInputSchema = z.object({
  description: z.string().trim().max(2_000).nullable().optional().default(null),
  name: z.string().trim().min(2).max(160),
  reorderPoint: z.number().int().min(0).max(1_000_000),
  salePrice: z
    .string()
    .regex(/^\d{1,10}\.\d{2}$/)
    .refine((value) => Number(value) >= 0, 'Sale price cannot be negative.'),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .transform((value) => value.toUpperCase()),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const CustomerInputSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: OptionalContactSchema,
  email: OptionalEmailSchema,
  phone: OptionalPhoneSchema,
});
export type CustomerInput = z.infer<typeof CustomerInputSchema>;

export const SupplierInputSchema = CustomerInputSchema;
export type SupplierInput = z.infer<typeof SupplierInputSchema>;

const MoneySchema = z
  .string()
  .regex(/^\d{1,10}\.\d{2}$/)
  .refine((value) => Number(value) >= 0, 'Money cannot be negative.');

const ReceiptLineInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().max(1_000_000),
  unitCost: MoneySchema.nullable().optional().default(null),
});

export const ReceiptInputSchema = z
  .object({
    lines: z.array(ReceiptLineInputSchema).min(1).max(200),
    note: z.string().trim().max(1_000).nullable().optional().default(null),
    receiptNumber: z.string().trim().min(2).max(80),
    receivedAt: z.iso.datetime({ offset: true }),
    supplierId: z.uuid(),
  })
  .refine(
    (value) =>
      new Set(value.lines.map((line) => line.productId)).size ===
      value.lines.length,
    { message: 'A product can appear only once per receipt.', path: ['lines'] },
  );
export type ReceiptInput = z.infer<typeof ReceiptInputSchema>;

export const InventoryAdjustmentInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(3).max(500),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
});
export type InventoryAdjustmentInput = z.infer<
  typeof InventoryAdjustmentInputSchema
>;

const SalesOrderLineInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().max(1_000_000),
});

export const SalesOrderInputSchema = z
  .object({
    customerId: z.uuid(),
    lines: z.array(SalesOrderLineInputSchema).min(1).max(200),
    note: z.string().trim().max(1_000).nullable().optional().default(null),
  })
  .refine(
    (value) =>
      new Set(value.lines.map((line) => line.productId)).size ===
      value.lines.length,
    { message: 'A product can appear only once per order.', path: ['lines'] },
  );
export type SalesOrderInput = z.infer<typeof SalesOrderInputSchema>;
