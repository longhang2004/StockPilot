/**
 * Shared integration-test environment bootstrap.
 *
 * Every integration suite boots the full Nest application graph, which
 * requires the same minimal configuration surface. This module centralizes
 * that surface; suites only override what their scenario needs (e.g. a
 * unique demo slug per suite).
 */

export const TEST_WEB_ORIGIN = 'http://localhost:3000';

const DEFAULT_DATABASE_URL =
  'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
const DEFAULT_ADMIN_DATABASE_URL =
  'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';

/** Runtime (RLS-enforced) database URL for the application under test. */
export function appDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

/** Admin (migration) database URL used to provision/clean up fixtures. */
export function adminDatabaseUrl(): string {
  return process.env.MIGRATION_DATABASE_URL ?? DEFAULT_ADMIN_DATABASE_URL;
}

/**
 * Applies the minimal environment the application module graph requires,
 * preserving any DATABASE_URL already provided by the runner. Suites pass
 * overrides for values their scenario depends on (demo slug, per-suite
 * CSRF/webhook secrets to keep suites independent when run in parallel).
 */
export function setTestEnvironment(
  overrides: Record<string, string> = {},
): void {
  Object.assign(process.env, {
    CSRF_SECRET: 'integration-csrf-secret-with-at-least-32-characters',
    DATABASE_URL: appDatabaseUrl(),
    DEMO_MODE: 'true',
    NODE_ENV: 'test',
    SESSION_COOKIE_NAME: 'stockpilot_session',
    SESSION_TTL_HOURS: '12',
    WEB_ORIGIN: TEST_WEB_ORIGIN,
    WEBHOOK_SIGNING_SECRET: 'integration-webhook-secret',
    ...overrides,
  });
}
