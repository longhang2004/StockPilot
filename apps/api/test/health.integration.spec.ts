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
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    const response = await request(app.getHttpServer()).get('/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'stockpilot-api',
      status: 'ok',
    });
  });
});
