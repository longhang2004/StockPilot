import { describe, expect, it } from 'vitest';

import { parseEnvironment } from '../config/environment.js';

describe('JobRunnerService', () => {
  it('keeps local development explicit when no queue database is configured', async () => {
    const { JobRunnerService } = await import('./job-runner.service.js');
    const service = new JobRunnerService(
      parseEnvironment({
        CSRF_SECRET: 'test-secret-with-at-least-32-characters',
        DATABASE_URL: 'postgresql://app',
        NODE_ENV: 'test',
        WEBHOOK_SIGNING_SECRET: 'webhook-secret-with-16-chars',
        WEB_ORIGIN: 'http://localhost:3000',
      }),
    );

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
