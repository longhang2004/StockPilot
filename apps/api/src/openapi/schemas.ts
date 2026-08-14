/**
 * OpenAPI bridge over the Zod contracts.
 *
 * Runtime validation stays where it already is: the Zod schemas in
 * `@stockpilot/contracts` (and API-local schemas) are parsed by the
 * controllers. This module is the documentation-only projection of those
 * schemas into OpenAPI 3.1 objects, so Swagger never drifts into a second
 * hand-maintained DTO layer.
 *
 * `zod-openapi` is a small conversion library (no framework): it turns a
 * Zod type into an OpenAPI schema object. Controllers reference the schemas
 * by name through the `ref()` helper, and `configureApplication` merges the
 * converted components into the generated document once at startup.
 */
import { createSchema } from 'zod-openapi';
import {
  CustomerInputSchema,
  InventoryAdjustmentInputSchema,
  ProblemDetailsSchema,
  ProductInputSchema,
  ReceiptInputSchema,
  SalesOrderInputSchema,
  SupplierInputSchema,
} from '@stockpilot/contracts';
import { z } from 'zod';

// The API-local request schemas below are the SAME objects the controllers
// parse at runtime (imported from the domain schema modules), so the
// documented contract cannot drift from validation.
import {
  DemoLoginInputSchema,
  LoginInputSchema,
  SignupInputSchema,
  SwitchWorkspaceInputSchema,
} from '../auth/auth-schemas.js';
import {
  CatalogListQuerySchema,
  PartnerUpdateSchema,
  ProductUpdateSchema,
} from '../catalog/catalog-schemas.js';
import {
  AlertListQuerySchema,
  InventoryListQuerySchema,
} from '../inventory/inventory-schemas.js';
import { ImportPreviewInputSchema } from '../imports/import-schemas.js';
import { OrderListQuerySchema } from '../orders/orders-schemas.js';

// ---------------------------------------------------------------------------
// Response schemas. These mirror what the services actually return (the
// serializers are the reference), so the Swagger UI is usable without
// reading controller source.
// ---------------------------------------------------------------------------

const UuidSchema = z.uuid();
const DateTimeSchema = z.iso.datetime();
const MoneyStringSchema = z
  .string()
  .regex(/^\d+\.\d{2}$/)
  .describe('Decimal money as a two-decimal string.');

const OrganizationBriefSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: z.string(),
  currency: z.string(),
  isDemo: z.boolean(),
  nextDemoResetAt: DateTimeSchema.nullable(),
});

const MembershipSchema = z.object({
  id: UuidSchema,
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']),
  organization: OrganizationBriefSchema,
});

const UserBriefSchema = z.object({
  id: UuidSchema,
  displayName: z.string(),
  email: z.string(),
});

/** Body returned by login/signup/demo-login/switch-workspace. */
const AuthSessionResultSchema = z.object({
  membership: MembershipSchema.nullable(),
  user: UserBriefSchema,
  csrfToken: z.string(),
});

/** Body returned by GET /v1/auth/session. */
const SessionInfoSchema = z.object({
  membership: MembershipSchema.nullable(),
  user: UserBriefSchema,
});

const ProductImageSchema = z.object({
  format: z.string(),
  height: z.number().int().positive(),
  url: z.url(),
  width: z.number().int().positive(),
});

const ProductSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  salePrice: MoneyStringSchema,
  reorderPoint: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  image: ProductImageSchema.nullable(),
});

const CustomerSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  companyName: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

const SupplierSchema = CustomerSchema;

const PageShapeSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

const ProductListSchema = PageShapeSchema.extend({
  items: z.array(ProductSchema),
});
const CustomerListSchema = PageShapeSchema.extend({
  items: z.array(CustomerSchema),
});
const SupplierListSchema = PageShapeSchema.extend({
  items: z.array(SupplierSchema),
});

const BalanceSummarySchema = z.object({
  available: z.number().int(),
  onHand: z.number().int(),
  productId: UuidSchema,
  reserved: z.number().int(),
});

const StockMovementSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  type: z.enum(['RECEIPT', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantityDelta: z.number().int(),
  onHandAfter: z.number().int(),
  referenceType: z.string(),
  referenceId: UuidSchema,
  reason: z.string().nullable(),
  actorUserId: UuidSchema.nullable(),
  createdAt: DateTimeSchema,
});

const ProductBriefSchema = z.object({
  name: z.string(),
  sku: z.string(),
});

/** Item returned by GET /v1/inventory/movements (includes product brief). */
const StockMovementItemSchema = StockMovementSchema.extend({
  product: ProductBriefSchema,
});

const StockMovementListSchema = PageShapeSchema.extend({
  items: z.array(StockMovementItemSchema),
});

/** Item returned by GET /v1/inventory/balances (derived from inventory-query.service). */
const InventoryBalanceSchema = z.object({
  available: z.number().int(),
  id: UuidSchema,
  onHand: z.number().int(),
  product: ProductBriefSchema,
  productId: UuidSchema,
  reserved: z.number().int(),
  updatedAt: DateTimeSchema,
  warehouseId: UuidSchema,
});

const InventoryBalanceListSchema = PageShapeSchema.extend({
  items: z.array(InventoryBalanceSchema),
});

/** Item returned by GET /v1/alerts (raw LowStockAlert row plus product brief). */
const LowStockAlertSchema = z.object({
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

const LowStockAlertListSchema = PageShapeSchema.extend({
  items: z.array(LowStockAlertSchema),
});

const ReceiptResultSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  supplierId: UuidSchema,
  receiptNumber: z.string(),
  receivedAt: DateTimeSchema,
  note: z.string().nullable(),
  actorUserId: UuidSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
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

const AdjustmentResultSchema = z.object({
  balance: BalanceSummarySchema,
  movement: StockMovementSchema,
});

const SalesOrderLineSchema = z.object({
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

const OrderTransitionSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  salesOrderId: UuidSchema,
  fromStatus: z
    .enum(['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED'])
    .nullable(),
  toStatus: z.enum(['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED']),
  actorUserId: UuidSchema,
  note: z.string().nullable(),
  createdAt: DateTimeSchema,
});

const SalesOrderSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  customerId: UuidSchema,
  orderNumber: z.string(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED']),
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

const SalesOrderDetailSchema = SalesOrderSchema.extend({
  lines: z.array(SalesOrderLineSchema),
  transitions: z.array(OrderTransitionSchema),
});

const OrderListSchema = PageShapeSchema.extend({
  items: z.array(SalesOrderSchema),
});

const ImportPreviewResultSchema = z.object({
  id: UuidSchema,
  fileName: z.string(),
  totalRows: z.number().int(),
  validRows: z.number().int(),
  errorRows: z.number().int(),
  createdAt: DateTimeSchema,
});

const ImportCommitResultSchema = z.object({
  created: z.number().int(),
  id: UuidSchema,
  updated: z.number().int(),
});

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

const NAMED_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  LoginInput: LoginInputSchema,
  SignupInput: SignupInputSchema,
  DemoLoginInput: DemoLoginInputSchema,
  SwitchWorkspaceInput: SwitchWorkspaceInputSchema,
  ProductInput: ProductInputSchema,
  ProductUpdateInput: ProductUpdateSchema,
  CustomerInput: CustomerInputSchema,
  CustomerUpdateInput: PartnerUpdateSchema,
  SupplierInput: SupplierInputSchema,
  SupplierUpdateInput: PartnerUpdateSchema,
  ReceiptInput: ReceiptInputSchema,
  InventoryAdjustmentInput: InventoryAdjustmentInputSchema,
  SalesOrderInput: SalesOrderInputSchema,
  ImportPreviewInput: ImportPreviewInputSchema,
  ProductListQuery: CatalogListQuerySchema,
  PartnerListQuery: CatalogListQuerySchema,
  OrderListQuery: OrderListQuerySchema,
  InventoryListQuery: InventoryListQuerySchema,
  AlertListQuery: AlertListQuerySchema,
  AuthSessionResult: AuthSessionResultSchema,
  SessionInfo: SessionInfoSchema,
  Product: ProductSchema,
  ProductList: ProductListSchema,
  Customer: CustomerSchema,
  CustomerList: CustomerListSchema,
  Supplier: SupplierSchema,
  SupplierList: SupplierListSchema,
  ReceiptResult: ReceiptResultSchema,
  AdjustmentResult: AdjustmentResultSchema,
  SalesOrder: SalesOrderSchema,
  SalesOrderDetail: SalesOrderDetailSchema,
  OrderList: OrderListSchema,
  StockMovement: StockMovementSchema,
  ImportPreviewResult: ImportPreviewResultSchema,
  ImportCommitResult: ImportCommitResultSchema,
  InventoryBalance: InventoryBalanceSchema,
  InventoryBalanceList: InventoryBalanceListSchema,
  StockMovementList: StockMovementListSchema,
  LowStockAlert: LowStockAlertSchema,
  LowStockAlertList: LowStockAlertListSchema,
  ProblemDetails: ProblemDetailsSchema,
};

/**
 * Update inputs reject an empty payload at runtime via a Zod `.refine`
 * (`Object.keys(value).length > 0`). Zod refinements are not representable
 * in OpenAPI, so the projection carries the closest structural constraint,
 * `minProperties: 1`. The semantic difference is intentional and documented
 * here: the OpenAPI document cannot express the custom message, only the
 * cardinality rule.
 */
const MIN_PROPERTIES_UPDATE_INPUTS: ReadonlySet<string> = new Set([
  'ProductUpdateInput',
  'CustomerUpdateInput',
  'SupplierUpdateInput',
]);

/**
 * OpenAPI schema objects for every named schema above. Built once at module
 * load; controllers reference them with `schemaRef('ProductInput')`.
 */
export const openApiSchemas: Readonly<Record<string, unknown>> =
  Object.fromEntries(
    Object.entries(NAMED_SCHEMAS).map(([name, zodSchema]) => {
      const converted = createSchema(zodSchema, { io: 'input' }).schema;
      if (MIN_PROPERTIES_UPDATE_INPUTS.has(name)) {
        return [
          name,
          { ...(converted as Record<string, unknown>), minProperties: 1 },
        ];
      }
      return [name, converted];
    }),
  );

/** `$ref` object for a named schema, for use in @nestjs/swagger decorators. */
export function schemaRef(name: keyof typeof NAMED_SCHEMAS & string): {
  $ref: string;
} {
  if (!(name in NAMED_SCHEMAS)) {
    throw new Error(`Unknown OpenAPI schema: ${name}`);
  }
  return { $ref: `#/components/schemas/${name}` };
}

/** Shared OpenAPI definition of the Idempotency-Key header. */
export const IDEMPOTENCY_KEY_HEADER = {
  name: 'Idempotency-Key',
  required: true,
  description:
    'Stable client-generated key (8-255 chars of [A-Za-z0-9._:-]). Reusing a key with the same payload replays the original response; a different payload returns 409.',
  schema: {
    type: 'string',
    minLength: 8,
    maxLength: 255,
    pattern: '^[A-Za-z0-9._:-]+$',
  },
} as const;
