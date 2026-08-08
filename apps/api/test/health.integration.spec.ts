import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

describe('health endpoints', () => {
  let app: INestApplication | undefined;

  // The app bootstraps the full module graph, so the required configuration
  // surface must be present (same minimal set as the other integration
  // suites; the health endpoints themselves do not touch the database).
  beforeAll(() => {
    Object.assign(process.env, {
      CSRF_SECRET: 'integration-csrf-secret-with-at-least-32-characters',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot',
      NODE_ENV: 'test',
      WEB_ORIGIN: 'http://localhost:3000',
      WEBHOOK_SIGNING_SECRET: 'integration-webhook-secret',
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  it('exposes liveness under the versioned API prefix', async () => {
    const { AppModule } = await import('../src/app.module.js');
    const { configureApplication } =
      await import('../src/configure-application.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();

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
      const { AppModule } = await import('../src/app.module.js');
      const { configureApplication } =
        await import('../src/configure-application.js');
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      configureApplication(app);
      await app.init();

      const readiness = await request(app.getHttpServer()).get(
        '/v1/health/ready',
      );
      expect(readiness.status).toBe(503);
      expect(readiness.body).toEqual({
        checks: { database: 'ok', queue: 'not_configured' },
        status: 'degraded',
      });
    } finally {
      if (previous === undefined) delete process.env.QUEUE_REQUIRED;
      else process.env.QUEUE_REQUIRED = previous;
    }
  });
});
