-- Synthetic movement fixture for the disposable local performance stack only.
-- Invoke with psql -v fixture_count=<1..100000> in that project's postgres service.
BEGIN;

WITH fixture_target AS (
  SELECT balance.id AS balance_id,
         balance.organization_id,
         balance.warehouse_id,
         balance.product_id,
         balance.on_hand AS starting_on_hand,
         (SELECT max(movement.created_at)
            FROM stock_movements AS movement
           WHERE movement.organization_id = balance.organization_id
             AND movement.product_id = balance.product_id) AS last_movement_at,
         manager.id AS actor_user_id
  FROM inventory_balances AS balance
  JOIN products AS product
    ON product.organization_id = balance.organization_id
   AND product.id = balance.product_id
   AND product.is_active
  JOIN memberships AS membership
    ON membership.organization_id = balance.organization_id
   AND membership.role = 'MANAGER'
  JOIN users AS manager ON manager.id = membership.user_id
  JOIN organizations AS organization
    ON organization.id = balance.organization_id
   AND organization.slug = 'stockpilot-demo'
  ORDER BY product.sku, balance.id
  LIMIT 1
),
updated_balance AS (
  UPDATE inventory_balances AS balance
     SET on_hand = balance.on_hand + :'fixture_count'::integer,
         version = balance.version + 1,
         updated_at = now()
    FROM fixture_target AS target
   WHERE balance.id = target.balance_id
  RETURNING balance.organization_id,
            balance.warehouse_id,
            balance.product_id,
            balance.on_hand - :'fixture_count'::integer AS starting_on_hand,
            balance.on_hand AS ending_on_hand,
            target.last_movement_at,
            (SELECT actor_user_id FROM fixture_target) AS actor_user_id
)
INSERT INTO stock_movements (
  id, organization_id, warehouse_id, product_id, type, quantity_delta,
  on_hand_after, reference_type, reference_id, reason, actor_user_id, created_at
)
SELECT gen_random_uuid(),
       updated.organization_id,
       updated.warehouse_id,
       updated.product_id,
       'ADJUSTMENT_IN'::"StockMovementType",
       1,
       updated.starting_on_hand + generated.sequence,
       'PERF_FIXTURE',
       gen_random_uuid(),
       'Synthetic local performance fixture',
       updated.actor_user_id,
       GREATEST(transaction_timestamp(), COALESCE(updated.last_movement_at + interval '1 microsecond', transaction_timestamp()))
         + (generated.sequence - 1) * interval '1 microsecond'
  FROM updated_balance AS updated
 CROSS JOIN generate_series(1, :'fixture_count'::integer) AS generated(sequence);

COMMIT;
