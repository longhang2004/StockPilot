import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { setTestEnvironment } from './support/environment.js';
import { createTestApplication } from './support/test-app.js';

describe('health endpoints', () => {
  let app: INestApplication | undefined;

  // The app bootstraps the full module graph, so the required configuration
  // surface must be present (same minimal set as the other integration
  // suites; the health endpoints themselves do not touch the database).
  beforeAll(() => {
    setTestEnvironment();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('exposes liveness under the versioned API prefix', async () => {
    ({ app } = await createTestApplication());

    const response = await request(app.getHttpServer()).get('/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'stockpilot-api',
      status: 'ok',
    });

    const readiness = await request(app.getHttpServer()).get(
      '/v1/health/ready',
    );
    expect(readiness.status).toBe(200);
    expect(readiness.body).toEqual({
      checks: { database: 'ok', queue: 'not_configured' },
      rateLimit: {
        buckets: 0,
        rejected: { public: 0, auth: 0, user: 0 },
        limits: {
          publicWritesPerMinute: 60,
          authWritesPerMinute: 60,
          userWritesPerMinute: 240,
        },
      },
      status: 'ready',
    });

    const openApi = await request(app.getHttpServer()).get('/openapi.json');
    expect(openApi.status).toBe(200);
    expect(openApi.body.info.title).toBe('StockPilot API');
  });

  it('returns 503 when the queue is required but not configured', async () => {
    const previous = process.env.QUEUE_REQUIRED;
    process.env.QUEUE_REQUIRED = 'true';
    try {
      ({ app } = await createTestApplication());

      const readiness = await request(app.getHttpServer()).get(
        '/v1/health/ready',
      );
      expect(readiness.status).toBe(503);
      expect(readiness.body).toEqual({
        checks: { database: 'ok', queue: 'not_configured' },
        rateLimit: {
          buckets: 0,
          rejected: { public: 0, auth: 0, user: 0 },
          limits: {
            publicWritesPerMinute: 60,
            authWritesPerMinute: 60,
            userWritesPerMinute: 240,
          },
        },
        status: 'degraded',
      });
    } finally {
      if (previous === undefined) delete process.env.QUEUE_REQUIRED;
      else process.env.QUEUE_REQUIRED = previous;
    }
  });
});
