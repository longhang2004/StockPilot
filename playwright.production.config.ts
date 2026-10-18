import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4187';

export default defineConfig({
  // This profile points at the production web/API containers started by
  // scripts/run-production-e2e.sh. It deliberately has no webServer command.
  fullyParallel: false,
  testDir: './tests/e2e',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-production' }],
  ],
  outputDir: 'test-results-production',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-production', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-production', use: { ...devices['Pixel 5'] } },
  ],
});
