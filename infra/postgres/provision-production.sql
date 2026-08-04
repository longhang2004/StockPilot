-- Provision the least-privilege runtime roles for a Neon deployment.
--
-- Run this script with the Neon migration/direct connection, never with the
-- pooled application URL. Passwords are supplied as psql variables and are
-- intentionally not stored in this repository:
--
--   psql "$MIGRATION_DATABASE_URL" \
--     -v app_password="$STOCKPILOT_APP_PASSWORD" \
--     -v queue_password="$STOCKPILOT_QUEUE_PASSWORD" \
--     -f infra/postgres/provision-production.sql
--
-- The migration role must be the Neon project owner (or another role allowed
-- to create roles/databases). The API receives only the pooled app URL and the
-- pg-boss worker receives a direct URL to stockpilot_queue.

\set ON_ERROR_STOP on

\if :{?app_password}
\else
  \echo 'Missing required psql variable: app_password'
  \quit 3
\endif
\if :{?queue_password}
\else
  \echo 'Missing required psql variable: queue_password'
  \quit 3
\endif

SELECT current_database() AS application_database \gset

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stockpilot_app') THEN
    CREATE ROLE stockpilot_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      INHERIT
      NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stockpilot_queue') THEN
    CREATE ROLE stockpilot_queue
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      INHERIT
      NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE stockpilot_app
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  INHERIT
  NOBYPASSRLS
  PASSWORD :'app_password';

ALTER ROLE stockpilot_queue
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  INHERIT
  NOBYPASSRLS
  PASSWORD :'queue_password';

GRANT CONNECT ON DATABASE :"application_database" TO stockpilot_app;
GRANT USAGE ON SCHEMA public TO stockpilot_app;

SELECT format(
  'CREATE DATABASE %I OWNER %I',
  'stockpilot_queue',
  'stockpilot_queue'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'stockpilot_queue'
) \gexec

GRANT CONNECT ON DATABASE stockpilot_queue TO stockpilot_queue;

-- Verification: these rows must remain true after every provisioning change.
SELECT
  rolname,
  rolsuper,
  rolinherit,
  rolcreaterole,
  rolcreatedb,
  rolbypassrls
FROM pg_roles
WHERE rolname IN ('stockpilot_app', 'stockpilot_queue')
ORDER BY rolname;

SELECT
  EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles member ON member.oid = membership.member
    JOIN pg_roles parent ON parent.oid = membership.roleid
    WHERE member.rolname = 'stockpilot_app'
      AND parent.rolname = 'neon_superuser'
  ) AS app_is_neon_superuser,
  has_database_privilege('stockpilot_app', current_database(), 'CONNECT')
    AS app_can_connect_application_database,
  has_schema_privilege('stockpilot_app', 'public', 'USAGE')
    AS app_can_use_public_schema;

SELECT
  relname AS tenant_table,
  relrowsecurity,
  relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'products',
  'inventory_balances',
  'stock_movements',
  'sales_orders',
  'audit_events'
)
ORDER BY relname;
