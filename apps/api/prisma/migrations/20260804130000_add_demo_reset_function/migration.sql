CREATE OR REPLACE FUNCTION stockpilot_reset_demo_data(target_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_organization BOOLEAN;
BEGIN
  SELECT "is_demo"
    INTO demo_organization
    FROM "organizations"
   WHERE "id" = target_organization_id;

  IF demo_organization IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Only demo organizations can be reset';
  END IF;

  DELETE FROM "idempotency_records" WHERE "organization_id" = target_organization_id;
  DELETE FROM "integration_deliveries" WHERE "organization_id" = target_organization_id;
  DELETE FROM "product_import_runs" WHERE "organization_id" = target_organization_id;
  DELETE FROM "audit_events" WHERE "organization_id" = target_organization_id;
  DELETE FROM "order_transitions" WHERE "organization_id" = target_organization_id;
  DELETE FROM "sales_order_lines" WHERE "organization_id" = target_organization_id;
  DELETE FROM "sales_orders" WHERE "organization_id" = target_organization_id;
  DELETE FROM "low_stock_alerts" WHERE "organization_id" = target_organization_id;
  DELETE FROM "goods_receipt_lines" WHERE "organization_id" = target_organization_id;
  DELETE FROM "goods_receipts" WHERE "organization_id" = target_organization_id;
  DELETE FROM "stock_movements" WHERE "organization_id" = target_organization_id;
  DELETE FROM "inventory_balances" WHERE "organization_id" = target_organization_id;
  DELETE FROM "products" WHERE "organization_id" = target_organization_id;
  DELETE FROM "customers" WHERE "organization_id" = target_organization_id;
  DELETE FROM "suppliers" WHERE "organization_id" = target_organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION stockpilot_reset_demo_data(UUID) TO stockpilot_app;
