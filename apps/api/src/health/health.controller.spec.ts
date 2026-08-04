import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

describe('HealthController', () => {
  it('reports a live API process', async () => {
    const { HealthController } = await import('./health.controller.js');
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: (await import('../database/prisma.service.js'))
            .PrismaService,
          useValue: { $queryRaw: vi.fn() },
        },
      ],
    }).compile();

    expect(moduleRef.get(HealthController).live()).toEqual({
      service: 'stockpilot-api',
      status: 'ok',
    });
  });

  it('reports database readiness and explicit queue configuration', async () => {
    const { HealthController } = await import('./health.controller.js');
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: (await import('../database/prisma.service.js'))
            .PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    await expect(moduleRef.get(HealthController).ready()).resolves.toEqual({
      checks: { database: 'ok', queue: 'not_configured' },
      status: 'ready',
    });
  });
});
