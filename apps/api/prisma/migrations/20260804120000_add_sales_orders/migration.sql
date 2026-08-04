CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED');

CREATE TABLE "sales_orders" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "order_number" VARCHAR(80) NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
  "customer_company_name" VARCHAR(160) NOT NULL,
  "customer_contact_name" VARCHAR(160),
  "customer_email" VARCHAR(320),
  "note" VARCHAR(1000),
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_by_user_id" UUID NOT NULL,
  "confirmed_at" TIMESTAMPTZ(3),
  "fulfilled_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_orders_subtotal_check" CHECK ("subtotal" >= 0)
);

CREATE TABLE "sales_order_lines" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "sales_order_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "sku_snapshot" VARCHAR(64) NOT NULL,
  "product_name_snapshot" VARCHAR(160) NOT NULL,
  "unit_price" DECIMAL(12,2) NOT NULL,
  "line_total" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_order_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "sales_order_lines_unit_price_check" CHECK ("unit_price" >= 0),
  CONSTRAINT "sales_order_lines_line_total_check" CHECK ("line_total" >= 0)
);

CREATE TABLE "order_transitions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "sales_order_id" UUID NOT NULL,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus" NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "note" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_transitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_orders_organization_id_order_number_key"
  ON "sales_orders"("organization_id", "order_number");
CREATE UNIQUE INDEX "sales_orders_organization_id_id_key"
  ON "sales_orders"("organization_id", "id");
CREATE INDEX "sales_orders_organization_id_status_created_at_idx"
  ON "sales_orders"("organization_id", "status", "created_at");
CREATE UNIQUE INDEX "sales_order_lines_organization_id_sales_order_id_product_id_key"
  ON "sales_order_lines"("organization_id", "sales_order_id", "product_id");
CREATE INDEX "sales_order_lines_organization_id_product_id_idx"
  ON "sales_order_lines"("organization_id", "product_id");
CREATE INDEX "order_transitions_organization_id_sales_order_id_created_at_idx"
  ON "order_transitions"("organization_id", "sales_order_id", "created_at");

ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organization_id_warehouse_id_fkey"
  FOREIGN KEY ("organization_id", "warehouse_id")
  REFERENCES "warehouses"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organization_id_customer_id_fkey"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_organization_id_sales_order_id_fkey"
  FOREIGN KEY ("organization_id", "sales_order_id")
  REFERENCES "sales_orders"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_organization_id_product_id_fkey"
  FOREIGN KEY ("organization_id", "product_id")
  REFERENCES "products"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_transitions" ADD CONSTRAINT "order_transitions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_transitions" ADD CONSTRAINT "order_transitions_organization_id_sales_order_id_fkey"
  FOREIGN KEY ("organization_id", "sales_order_id")
  REFERENCES "sales_orders"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE ON TABLE "sales_orders" TO stockpilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "sales_order_lines" TO stockpilot_app;
GRANT SELECT, INSERT ON TABLE "order_transitions" TO stockpilot_app;
REVOKE DELETE ON TABLE "sales_orders" FROM stockpilot_app;
REVOKE UPDATE, DELETE ON TABLE "order_transitions" FROM stockpilot_app;

ALTER TABLE "sales_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_orders" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sales_order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_order_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_transitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_transitions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "sales_orders_tenant_isolation" ON "sales_orders"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "sales_order_lines_tenant_isolation" ON "sales_order_lines"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "order_transitions_tenant_isolation" ON "order_transitions"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
