import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // The E2E suite shares one seeded demo database and mutates it (receipts,
  // orders, and the Owner demo reset which wipes and reseeds the tenant), so
  // tests are only deterministic when they run one at a time. CI already
  // forced workers:1; local runs must too, or parallel workers race on the
  // shared fixture (e.g. owner-reset mid-receipt).
  fullyParallel: false,
  testDir: './tests/e2e',
  workers: 1,
  // CI-only single retry: `next dev` occasionally drops a connection while
  // recompiling a route on demand (reproduced as ERR_CONNECTION_REFUSED /
  // socket hang up on /api rewrites and image routes; absent in production
  // `next start`). This is environment flakiness, not an application bug —
  // the deterministic failures this suite had (API startup race, parallel
  // workers sharing the demo DB, loader contrast) are fixed in code.
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    // The harness must own its API/web processes: scripts/e2e-server.mjs
    // starts the API first and only boots the web app once /v1/health/ready
    // is green (the DB-backed readiness probe, not mere liveness). Stale
    // local servers are never reused — Playwright fails fast with an
    // actionable occupied-port error instead of testing unknown code.
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
