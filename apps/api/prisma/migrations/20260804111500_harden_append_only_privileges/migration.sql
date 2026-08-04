-- The initial local bootstrap granted broad default table privileges. Revoke
-- mutation rights from append-only operational records for existing databases.
REVOKE UPDATE, DELETE ON TABLE
  "stock_movements",
  "goods_receipts",
  "goods_receipt_lines",
  "audit_events"
FROM stockpilot_app;
