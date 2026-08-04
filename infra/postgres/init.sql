DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stockpilot_app') THEN
    CREATE ROLE stockpilot_app
      LOGIN
      PASSWORD 'stockpilot_app'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO stockpilot_app',
    current_database()
  );
END
$$;
GRANT USAGE ON SCHEMA public TO stockpilot_app;
-- Migrations grant the minimum table privileges explicitly. Keeping default
-- privileges empty prevents a newly-created tenant table from accidentally
-- becoming writable by the runtime role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM stockpilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM stockpilot_app;
