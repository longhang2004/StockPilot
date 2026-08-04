import { describe, expect, it, vi } from 'vitest';

describe('PrismaService', () => {
  it('disconnects cleanly during Nest shutdown', async () => {
    const { PrismaService } = await import('./prisma.service.js');
    const service = new PrismaService({
      API_INTERNAL_URL: undefined,
      CSRF_SECRET: 'test-secret-with-at-least-32-characters',
      DATABASE_URL: 'postgresql://app:app@localhost:5432/stockpilot',
      DEMO_MODE: true,
      DEMO_ORGANIZATION_SLUG: 'stockpilot-demo',
      MIGRATION_DATABASE_URL: undefined,
      NODE_ENV: 'test',
      PORT: 4000,
      QUEUE_DATABASE_URL: undefined,
      QUEUE_REQUIRED: false,
      SENTRY_DSN: undefined,
      SESSION_COOKIE_NAME: 'stockpilot_session',
      SESSION_TTL_HOURS: 12,
      WEBHOOK_SIGNING_SECRET: 'webhook-secret-with-16-chars',
      WEB_ORIGIN: 'http://localhost:3000',
    });
    const disconnect = vi
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
