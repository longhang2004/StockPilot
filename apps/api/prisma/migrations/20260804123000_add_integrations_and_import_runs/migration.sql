CREATE TYPE "IntegrationDeliveryStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TABLE "integration_deliveries" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "external_delivery_id" VARCHAR(160) NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "IntegrationDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" VARCHAR(1000),
  "sales_order_id" UUID,
  "processed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "integration_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_import_runs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "status" VARCHAR(40) NOT NULL,
  "rows_total" INTEGER NOT NULL,
  "rows_valid" INTEGER NOT NULL,
  "rows_invalid" INTEGER NOT NULL,
  "errors" JSONB,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_import_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_import_runs_rows_check"
    CHECK ("rows_total" >= 0 AND "rows_valid" >= 0 AND "rows_invalid" >= 0 AND "rows_valid" + "rows_invalid" = "rows_total")
);

CREATE UNIQUE INDEX "integration_deliveries_organization_id_external_delivery_id_key"
  ON "integration_deliveries"("organization_id", "external_delivery_id");
CREATE INDEX "integration_deliveries_organization_id_status_created_at_idx"
  ON "integration_deliveries"("organization_id", "status", "created_at");
CREATE INDEX "product_import_runs_organization_id_created_at_idx"
  ON "product_import_runs"("organization_id", "created_at");

ALTER TABLE "integration_deliveries" ADD CONSTRAINT "integration_deliveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_import_runs" ADD CONSTRAINT "product_import_runs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE ON TABLE "integration_deliveries" TO stockpilot_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "product_import_runs" TO stockpilot_app;
REVOKE DELETE ON TABLE "integration_deliveries", "product_import_runs" FROM stockpilot_app;

ALTER TABLE "integration_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_deliveries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_import_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_import_runs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "integration_deliveries_tenant_isolation" ON "integration_deliveries"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY "product_import_runs_tenant_isolation" ON "product_import_runs"
  FOR ALL TO stockpilot_app
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
