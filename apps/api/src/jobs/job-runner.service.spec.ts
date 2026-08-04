import { describe, expect, it } from 'vitest';

describe('JobRunnerService', () => {
  it('keeps local development explicit when no queue database is configured', async () => {
    const { JobRunnerService } = await import('./job-runner.service.js');
    const service = new JobRunnerService({
      API_INTERNAL_URL: undefined,
      CSRF_SECRET: 'test-secret-with-at-least-32-characters',
      DATABASE_URL: 'postgresql://app',
      DEMO_MODE: true,
      DEMO_ORGANIZATION_SLUG: 'demo',
      MIGRATION_DATABASE_URL: undefined,
      NODE_ENV: 'test',
      PORT: 4000,
      QUEUE_REQUIRED: false,
      QUEUE_DATABASE_URL: undefined,
      SENTRY_DSN: undefined,
      SESSION_COOKIE_NAME: 'session',
      SESSION_TTL_HOURS: 12,
      WEBHOOK_SIGNING_SECRET: 'webhook-secret-with-16-chars',
      WEB_ORIGIN: 'http://localhost:3000',
    });

    expect(service.queueStatus()).toBe('not_configured');
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(
      service.enqueueIntegrationRetry({
        actorUserId: 'actor',
        deliveryId: 'delivery',
        organizationId: 'organization',
      }),
    ).resolves.toBeUndefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
