import { describe, expect, it } from 'vitest';

describe('parseEnvironment', () => {
  it('coerces numeric settings and applies safe defaults', async () => {
    const { parseEnvironment } = await import('./environment.js');

    const config = parseEnvironment({
      CSRF_SECRET: 'development-csrf-secret-with-enough-length',
      DATABASE_URL:
        'postgresql://stockpilot:stockpilot@localhost:5432/stockpilot',
      WEB_ORIGIN: 'http://localhost:3000',
      WEBHOOK_SIGNING_SECRET: 'development-secret-with-enough-length',
    });

    expect(config).toMatchObject({
      DEMO_MODE: true,
      NODE_ENV: 'development',
      PORT: 4000,
      QUEUE_REQUIRED: false,
      SESSION_TTL_HOURS: 12,
    });
  });

  it('accepts empty string for optional database and telemetry URLs from .env templates', async () => {
    const { parseEnvironment } = await import('./environment.js');

    const config = parseEnvironment({
      CSRF_SECRET: 'development-csrf-secret-with-enough-length',
      DATABASE_URL:
        'postgresql://stockpilot:stockpilot@localhost:5432/stockpilot',
      MIGRATION_DATABASE_URL: '',
      QUEUE_DATABASE_URL: '',
      SENTRY_DSN: '',
      STRIPE_SECRET_KEY: '',
      WEB_ORIGIN: 'http://localhost:3000',
      WEBHOOK_SIGNING_SECRET: 'development-secret-with-enough-length',
    });

    expect(config.MIGRATION_DATABASE_URL).toBe('');
    expect(config.QUEUE_DATABASE_URL).toBe('');
  });

  it('rejects startup when security-sensitive variables are missing', async () => {
    const { parseEnvironment } = await import('./environment.js');

    expect(() =>
      parseEnvironment({
        CSRF_SECRET: 'development-csrf-secret-with-enough-length',
        DATABASE_URL:
          'postgresql://stockpilot:stockpilot@localhost:5432/stockpilot',
        WEB_ORIGIN: 'http://localhost:3000',
      }),
    ).toThrow(/WEBHOOK_SIGNING_SECRET/);
  });
});
