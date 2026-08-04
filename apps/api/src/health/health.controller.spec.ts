import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

describe('HealthController', () => {
  it('reports a live API process', async () => {
    const { HealthController } = await import('./health.controller.js');
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    expect(moduleRef.get(HealthController).live()).toEqual({
      service: 'stockpilot-api',
      status: 'ok',
    });
  });

  it('reports readiness before dependency checks are enabled', async () => {
    const { HealthController } = await import('./health.controller.js');
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    expect(moduleRef.get(HealthController).ready()).toEqual({
      checks: { database: 'pending', queue: 'pending' },
      status: 'ready',
    });
  });
});
