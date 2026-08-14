/**
 * OpenAPI bridge over the Zod contracts.
 *
 * Runtime validation stays where it already is: the Zod schemas in
 * `@stockpilot/contracts` (and API-local schemas) are parsed by the
 * controllers. This module is the documentation-only projection of those
 * schemas into OpenAPI 3.1 objects, so Swagger never drifts into a second
 * hand-maintained DTO layer.
 *
 * Input schemas that are genuinely API-local (query strings, update
 * payloads, import payloads) remain in their domain modules. Every shared
 * response shape is imported from `@stockpilot/contracts` — the same
 * schemas the web client's read-only types are derived from — so the
 * documented contract cannot drift from the serializers.
 *
 * `zod-openapi` is a small conversion library (no framework): it turns a
 * Zod type into an OpenAPI schema object. Controllers reference the schemas
 * by name through the `ref()` helper, and `configureApplication` merges the
 * converted components into the generated document once at startup.
 */
import { createSchema } from 'zod-openapi';
import {
  AdjustmentResultSchema,
  AuthSessionResultSchema,
  CustomerInputSchema,
  CustomerListSchema,
  CustomerSchema,
  ImportCommitResultSchema,
  ImportPreviewResultSchema,
  InventoryAdjustmentInputSchema,
  InventoryBalanceListSchema,
  InventoryBalanceSchema,
  LowStockAlertListSchema,
  LowStockAlertSchema,
  OrderListSchema,
  ProblemDetailsSchema,
  ProductInputSchema,
  ProductListSchema,
  ProductSchema,
  ReceiptInputSchema,
  ReceiptResultSchema,
  SalesOrderDetailSchema,
  SalesOrderInputSchema,
  SalesOrderSchema,
  SessionInfoSchema,
  StockMovementListSchema,
  StockMovementSchema,
  SupplierInputSchema,
  SupplierListSchema,
  SupplierSchema,
} from '@stockpilot/contracts';
import type { z } from 'zod';

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
