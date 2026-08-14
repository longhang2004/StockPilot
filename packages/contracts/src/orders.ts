import { z } from 'zod';

import {
  DateTimeSchema,
  MoneyStringSchema,
  PageShapeSchema,
  UuidSchema,
} from './common.js';

export const OrderStatusSchema = z.enum([
  'DRAFT',
  'CONFIRMED',
  'FULFILLED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// ---------------------------------------------------------------------------
// Input contract (parsed by the API and reused by web forms)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Response contracts (wire shape produced by the API serializers)
// ---------------------------------------------------------------------------

export const SalesOrderLineSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  salesOrderId: UuidSchema,
  productId: UuidSchema,
  quantity: z.number().int(),
  skuSnapshot: z.string(),
  productNameSnapshot: z.string(),
  unitPrice: MoneyStringSchema,
  lineTotal: MoneyStringSchema,
});
export type SalesOrderLine = z.infer<typeof SalesOrderLineSchema>;

export const OrderTransitionSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  salesOrderId: UuidSchema,
  fromStatus: OrderStatusSchema.nullable(),
  toStatus: OrderStatusSchema,
  actorUserId: UuidSchema,
  note: z.string().nullable(),
  createdAt: DateTimeSchema,
});
export type OrderTransition = z.infer<typeof OrderTransitionSchema>;

export const SalesOrderSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  customerId: UuidSchema,
  orderNumber: z.string(),
  status: OrderStatusSchema,
  customerCompanyName: z.string(),
  customerContactName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  note: z.string().nullable(),
  subtotal: MoneyStringSchema,
  createdByUserId: UuidSchema,
  confirmedAt: DateTimeSchema.nullable(),
  fulfilledAt: DateTimeSchema.nullable(),
  cancelledAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export type SalesOrder = z.infer<typeof SalesOrderSchema>;

export const SalesOrderDetailSchema = SalesOrderSchema.extend({
  lines: z.array(SalesOrderLineSchema),
  transitions: z.array(OrderTransitionSchema),
});
export type SalesOrderDetail = z.infer<typeof SalesOrderDetailSchema>;

export const OrderListSchema = PageShapeSchema.extend({
  items: z.array(SalesOrderSchema),
});
export type OrderList = z.infer<typeof OrderListSchema>;
