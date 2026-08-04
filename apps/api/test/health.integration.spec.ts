import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

describe('health endpoints', () => {
  let app: INestApplication | undefined;

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
});
