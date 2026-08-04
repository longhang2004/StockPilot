import { describe, expect, it } from 'vitest';

describe('parseEnvironment', () => {
  it('coerces numeric settings and applies safe defaults', async () => {
    const { parseEnvironment } = await import('./environment.js');

    const config = parseEnvironment({
      DATABASE_URL:
        'postgresql://stockpilot:stockpilot@localhost:5432/stockpilot',
      WEB_ORIGIN: 'http://localhost:3000',
      WEBHOOK_SIGNING_SECRET: 'development-secret-with-enough-length',
    });

    expect(config).toMatchObject({
      DEMO_MODE: true,
      NODE_ENV: 'development',
      PORT: 4000,
      SESSION_TTL_HOURS: 12,
    });
  });

  it('rejects startup when security-sensitive variables are missing', async () => {
    const { parseEnvironment } = await import('./environment.js');

    expect(() =>
      parseEnvironment({
        DATABASE_URL:
          'postgresql://stockpilot:stockpilot@localhost:5432/stockpilot',
        WEB_ORIGIN: 'http://localhost:3000',
      }),
    ).toThrow(/WEBHOOK_SIGNING_SECRET/);
  });
});
