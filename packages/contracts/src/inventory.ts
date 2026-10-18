import { z } from 'zod';

import {
  DateTimeSchema,
  MoneySchema,
  MoneyStringSchema,
  PageShapeSchema,
  UuidSchema,
} from './common.js';

export const StockMovementTypeSchema = z.enum([
  'RECEIPT',
  'SALE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
]);
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

// ---------------------------------------------------------------------------
// Input contracts (parsed by the API and reused by web forms)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Response contracts (wire shape produced by the API serializers)
// ---------------------------------------------------------------------------

/** Per-product balance summary embedded in receipt/adjustment results. */
export const BalanceSummarySchema = z.object({
  available: z.number().int(),
  onHand: z.number().int(),
  productId: UuidSchema,
  reserved: z.number().int(),
});
export type BalanceSummary = z.infer<typeof BalanceSummarySchema>;

/** Append-only stock ledger row. */
export const StockMovementSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  type: StockMovementTypeSchema,
  quantityDelta: z.number().int(),
  onHandAfter: z.number().int(),
  referenceType: z.string(),
  referenceId: UuidSchema,
  reason: z.string().nullable(),
  actorUserId: UuidSchema.nullable(),
  createdAt: DateTimeSchema,
});
export type StockMovement = z.infer<typeof StockMovementSchema>;

const ProductBriefSchema = z.object({
  name: z.string(),
  sku: z.string(),
});

/** Item returned by GET /v1/inventory/movements (includes product brief). */
export const StockMovementItemSchema = StockMovementSchema.extend({
  product: ProductBriefSchema,
});
export type StockMovementItem = z.infer<typeof StockMovementItemSchema>;

export const StockMovementListSchema = PageShapeSchema.extend({
  items: z.array(StockMovementItemSchema),
});
export type StockMovementList = z.infer<typeof StockMovementListSchema>;

/** Item returned by GET /v1/inventory/balances (derived from inventory-query.service). */
export const InventoryBalanceSchema = z.object({
  available: z.number().int(),
  id: UuidSchema,
  onHand: z.number().int(),
  product: ProductBriefSchema,
  productId: UuidSchema,
  reserved: z.number().int(),
  updatedAt: DateTimeSchema,
  warehouseId: UuidSchema,
});
export type InventoryBalance = z.infer<typeof InventoryBalanceSchema>;

export const InventoryBalanceListSchema = PageShapeSchema.extend({
  items: z.array(InventoryBalanceSchema),
});
export type InventoryBalanceList = z.infer<typeof InventoryBalanceListSchema>;

export const InventorySummarySchema = z.object({
  trackedSkus: z.number().int().nonnegative(),
  availableUnits: z.number().int().nonnegative(),
  openAlerts: z.number().int().nonnegative(),
});
export type InventorySummary = z.infer<typeof InventorySummarySchema>;

const ReceiptSupplierBriefSchema = z.object({
  id: UuidSchema,
  companyName: z.string(),
});

const ReceiptProductBriefSchema = z.object({
  name: z.string(),
  sku: z.string(),
});

/** Document-level summary returned by GET /v1/receipts. */
export const ReceiptSummarySchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  supplierId: UuidSchema,
  supplier: ReceiptSupplierBriefSchema,
  receiptNumber: z.string(),
  receivedAt: DateTimeSchema,
  note: z.string().nullable(),
  actorUserId: UuidSchema.nullable(),
  createdAt: DateTimeSchema,
  lineCount: z.number().int().nonnegative(),
  totalQuantity: z.number().int().nonnegative(),
});
export type ReceiptSummary = z.infer<typeof ReceiptSummarySchema>;

/** Receipt detail returned by GET /v1/receipts/:id. */
export const ReceiptDetailSchema = ReceiptSummarySchema.extend({
  lines: z.array(
    z.object({
      id: UuidSchema,
      goodsReceiptId: UuidSchema,
      productId: UuidSchema,
      quantity: z.number().int().positive(),
      unitCost: MoneyStringSchema.nullable(),
      product: ReceiptProductBriefSchema,
    }),
  ),
});
export type ReceiptDetail = z.infer<typeof ReceiptDetailSchema>;

export const ReceiptListSchema = PageShapeSchema.extend({
  items: z.array(ReceiptSummarySchema),
});
export type ReceiptList = z.infer<typeof ReceiptListSchema>;

const ReservationRecordSchema = z.object({
  id: UuidSchema,
  orderId: UuidSchema,
  orderNumber: z.string(),
  customerCompanyName: z.string(),
  quantity: z.number().int().positive(),
  confirmedAt: DateTimeSchema.nullable(),
});

const ReservationListSchema = PageShapeSchema.extend({
  items: z.array(ReservationRecordSchema),
});

/** SKU, current balance, confirmed-order reservations and ledger trace. */
export const InventoryProductTraceSchema = z.object({
  product: z.object({
    id: UuidSchema,
    name: z.string(),
    sku: z.string(),
    reorderPoint: z.number().int().nonnegative(),
  }),
  balance: z
    .object({
      warehouseId: UuidSchema,
      onHand: z.number().int().nonnegative(),
      reserved: z.number().int().nonnegative(),
      available: z.number().int().nonnegative(),
      updatedAt: DateTimeSchema,
    })
    .nullable(),
  reservations: ReservationListSchema,
  movements: StockMovementListSchema,
});
export type InventoryProductTrace = z.infer<typeof InventoryProductTraceSchema>;

/** Item returned by GET /v1/alerts (raw LowStockAlert row plus product brief). */
export const LowStockAlertSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  status: z.enum(['OPEN', 'RESOLVED']),
  availableAtOpen: z.number().int(),
  reorderPoint: z.number().int(),
  openedAt: DateTimeSchema,
  resolvedAt: DateTimeSchema.nullable(),
  product: ProductBriefSchema,
});
export type LowStockAlert = z.infer<typeof LowStockAlertSchema>;

export const LowStockAlertListSchema = PageShapeSchema.extend({
  items: z.array(LowStockAlertSchema),
});
export type LowStockAlertList = z.infer<typeof LowStockAlertListSchema>;

/** Body returned by POST /v1/receipts. */
export const ReceiptResultSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  supplierId: UuidSchema,
  receiptNumber: z.string(),
  receivedAt: DateTimeSchema,
  note: z.string().nullable(),
  actorUserId: UuidSchema.nullable(),
  createdAt: DateTimeSchema,
  balances: z.array(BalanceSummarySchema),
  lines: z.array(
    z.object({
      id: UuidSchema,
      organizationId: UuidSchema,
      goodsReceiptId: UuidSchema,
      productId: UuidSchema,
      quantity: z.number().int(),
      unitCost: MoneyStringSchema.nullable(),
    }),
  ),
});
export type ReceiptResult = z.infer<typeof ReceiptResultSchema>;

/** Body returned by POST /v1/inventory/adjustments. */
export const AdjustmentResultSchema = z.object({
  balance: BalanceSummarySchema,
  movement: StockMovementSchema,
});
export type AdjustmentResult = z.infer<typeof AdjustmentResultSchema>;
