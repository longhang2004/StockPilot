-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM (
  'RECEIPT',
  'SALE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT'
);

CREATE TYPE "LowStockAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "sku" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "sale_price" DECIMAL(12,2) NOT NULL,
  "reorder_point" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_reorder_point_check" CHECK ("reorder_point" >= 0),
  CONSTRAINT "products_sale_price_check" CHECK ("sale_price" >= 0)
);

CREATE TABLE "customers" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "company_name" VARCHAR(160) NOT NULL,
  "contact_name" VARCHAR(160),
  "email" VARCHAR(320),
  "phone" VARCHAR(40),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "company_name" VARCHAR(160) NOT NULL,
  "contact_name" VARCHAR(160),
  "email" VARCHAR(320),
  "phone" VARCHAR(40),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_balances" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "on_hand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_balances_quantity_check"
    CHECK ("on_hand" >= "reserved" AND "reserved" >= 0)
);

CREATE TABLE "stock_movements" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity_delta" INTEGER NOT NULL,
  "on_hand_after" INTEGER NOT NULL,
  "reference_type" VARCHAR(40) NOT NULL,
  "reference_id" UUID NOT NULL,
  "reason" VARCHAR(500),
  "actor_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_movements_nonzero_quantity_check"
    CHECK ("quantity_delta" <> 0),
  CONSTRAINT "stock_movements_on_hand_after_check"
    CHECK ("on_hand_after" >= 0),
  CONSTRAINT "stock_movements_adjustment_reason_check"
    CHECK (
      "type" NOT IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT') OR
      NULLIF(BTRIM("reason"), '') IS NOT NULL
    )
);

CREATE TABLE "goods_receipts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "receipt_number" VARCHAR(80) NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL,
  "note" VARCHAR(1000),
  "actor_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goods_receipt_lines" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "goods_receipt_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_cost" DECIMAL(12,2),
  CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goods_receipt_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "goods_receipt_lines_unit_cost_check"
    CHECK ("unit_cost" IS NULL OR "unit_cost" >= 0)
);

CREATE TABLE "low_stock_alerts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "status" "LowStockAlertStatus" NOT NULL DEFAULT 'OPEN',
  "available_at_open" INTEGER NOT NULL,
  "reorder_point" INTEGER NOT NULL,
  "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  CONSTRAINT "low_stock_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "low_stock_alerts_available_check" CHECK ("available_at_open" >= 0),
  CONSTRAINT "low_stock_alerts_reorder_point_check" CHECK ("reorder_point" >= 0),
  CONSTRAINT "low_stock_alerts_resolution_check" CHECK (
    ("status" = 'OPEN' AND "resolved_at" IS NULL) OR
    ("status" = 'RESOLVED' AND "resolved_at" IS NOT NULL)
  )
);

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" UUID NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "scope" VARCHAR(80) NOT NULL,
  "key" VARCHAR(255) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "response_status" INTEGER NOT NULL,
  "response_body" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_response_status_check"
    CHECK ("response_status" BETWEEN 200 AND 599)
);

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_sku_key"
  ON "products"("organization_id", "sku");
CREATE UNIQUE INDEX "products_organization_id_id_key"
  ON "products"("organization_id", "id");
CREATE INDEX "products_organization_id_name_idx"
  ON "products"("organization_id", "name");

CREATE UNIQUE INDEX "customers_organization_id_id_key"
  ON "customers"("organization_id", "id");
CREATE INDEX "customers_organization_id_company_name_idx"
  ON "customers"("organization_id", "company_name");

CREATE UNIQUE INDEX "suppliers_organization_id_id_key"
  ON "suppliers"("organization_id", "id");
CREATE INDEX "suppliers_organization_id_company_name_idx"
  ON "suppliers"("organization_id", "company_name");

CREATE UNIQUE INDEX "inventory_balances_organization_id_warehouse_id_product_id_key"
  ON "inventory_balances"("organization_id", "warehouse_id", "product_id");
CREATE INDEX "inventory_balances_organization_id_product_id_idx"
  ON "inventory_balances"("organization_id", "product_id");

CREATE INDEX "stock_movements_organization_id_product_id_created_at_idx"
  ON "stock_movements"("organization_id", "product_id", "created_at");
CREATE INDEX "stock_movements_organization_id_reference_type_reference_id_idx"
  ON "stock_movements"("organization_id", "reference_type", "reference_id");

CREATE UNIQUE INDEX "goods_receipts_organization_id_receipt_number_key"
  ON "goods_receipts"("organization_id", "receipt_number");
CREATE UNIQUE INDEX "goods_receipts_organization_id_id_key"
  ON "goods_receipts"("organization_id", "id");
CREATE INDEX "goods_receipts_organization_id_received_at_idx"
  ON "goods_receipts"("organization_id", "received_at");

CREATE INDEX "goods_receipt_lines_organization_id_goods_receipt_id_idx"
  ON "goods_receipt_lines"("organization_id", "goods_receipt_id");

CREATE INDEX "low_stock_alerts_organization_id_status_opened_at_idx"
  ON "low_stock_alerts"("organization_id", "status", "opened_at");
CREATE INDEX "low_stock_alerts_organization_id_warehouse_id_product_id_idx"
  ON "low_stock_alerts"("organization_id", "warehouse_id", "product_id");
CREATE UNIQUE INDEX "low_stock_alerts_one_open_per_balance_key"
  ON "low_stock_alerts"("organization_id", "warehouse_id", "product_id")
  WHERE "status" = 'OPEN';

CREATE INDEX "audit_events_organization_id_created_at_idx"
  ON "audit_events"("organization_id", "created_at");
CREATE INDEX "audit_events_organization_id_entity_type_entity_id_idx"
  ON "audit_events"("organization_id", "entity_type", "entity_id");

CREATE UNIQUE INDEX "idempotency_records_organization_id_scope_key_key"
  ON "idempotency_records"("organization_id", "scope", "key");
CREATE INDEX "idempotency_records_expires_at_idx"
  ON "idempotency_records"("expires_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_warehouse_id_fkey"
  FOREIGN KEY ("organization_id", "warehouse_id")
  REFERENCES "warehouses"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_product_id_fkey"
  FOREIGN KEY ("organization_id", "product_id")
  REFERENCES "products"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_warehouse_id_fkey"
  FOREIGN KEY ("organization_id", "warehouse_id")
  REFERENCES "warehouses"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_product_id_fkey"
  FOREIGN KEY ("organization_id", "product_id")
  REFERENCES "products"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_warehouse_id_fkey"
  FOREIGN KEY ("organization_id", "warehouse_id")
  REFERENCES "warehouses"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_supplier_id_fkey"
  FOREIGN KEY ("organization_id", "supplier_id")
  REFERENCES "suppliers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_organization_id_goods_receipt_id_fkey"
  FOREIGN KEY ("organization_id", "goods_receipt_id")
  REFERENCES "goods_receipts"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_organization_id_product_id_fkey"
  FOREIGN KEY ("organization_id", "product_id")
  REFERENCES "products"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_organization_id_warehouse_id_fkey"
  FOREIGN KEY ("organization_id", "warehouse_id")
  REFERENCES "warehouses"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_organization_id_product_id_fkey"
  FOREIGN KEY ("organization_id", "product_id")
  REFERENCES "products"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Runtime privileges keep master data soft-deletable and ledger records immutable.
GRANT SELECT, INSERT, UPDATE ON TABLE
  "products", "customers", "suppliers", "inventory_balances",
  "low_stock_alerts"
TO stockpilot_app;

GRANT SELECT, INSERT ON TABLE
  "stock_movements", "goods_receipts", "goods_receipt_lines", "audit_events"
TO stockpilot_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "idempotency_records"
TO stockpilot_app;

-- Every tenant-owned table is inaccessible without a transaction-local org context.
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_balances" FORCE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "goods_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goods_receipts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "goods_receipt_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goods_receipt_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "low_stock_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "low_stock_alerts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_records" FORCE ROW LEVEL SECURITY;

CREATE POLICY "products_tenant_isolation" ON "products"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "customers_tenant_isolation" ON "customers"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "suppliers_tenant_isolation" ON "suppliers"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "inventory_balances_tenant_isolation" ON "inventory_balances"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "stock_movements_tenant_isolation" ON "stock_movements"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "goods_receipts_tenant_isolation" ON "goods_receipts"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "goods_receipt_lines_tenant_isolation" ON "goods_receipt_lines"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "low_stock_alerts_tenant_isolation" ON "low_stock_alerts"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "idempotency_records_tenant_isolation" ON "idempotency_records"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
