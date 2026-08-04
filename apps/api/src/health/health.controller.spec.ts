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
        {
          provide: (await import('../jobs/job-runner.service.js'))
            .JobRunnerService,
          useValue: { queueStatus: vi.fn().mockReturnValue('not_configured') },
        },
        {
          provide: (await import('../config/environment.module.js'))
            .ENVIRONMENT,
          useValue: { QUEUE_REQUIRED: false },
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
        {
          provide: (await import('../jobs/job-runner.service.js'))
            .JobRunnerService,
          useValue: { queueStatus: vi.fn().mockReturnValue('not_configured') },
        },
        {
          provide: (await import('../config/environment.module.js'))
            .ENVIRONMENT,
          useValue: { QUEUE_REQUIRED: false },
        },
      ],
    }).compile();

    const response = { status: vi.fn() };
    await expect(
      moduleRef.get(HealthController).ready(response),
    ).resolves.toEqual({
      checks: { database: 'ok', queue: 'not_configured' },
      status: 'ready',
    });
    expect(response.status).not.toHaveBeenCalled();
  });

  it('returns degraded readiness when the required queue is not configured', async () => {
    const { HealthController } = await import('./health.controller.js');
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: (await import('../database/prisma.service.js'))
            .PrismaService,
          useValue: {
            $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
        {
          provide: (await import('../jobs/job-runner.service.js'))
            .JobRunnerService,
          useValue: { queueStatus: vi.fn().mockReturnValue('not_configured') },
        },
        {
          provide: (await import('../config/environment.module.js'))
            .ENVIRONMENT,
          useValue: { QUEUE_REQUIRED: true },
        },
      ],
    }).compile();

    const response = { status: vi.fn() };
    await expect(
      moduleRef.get(HealthController).ready(response),
    ).resolves.toEqual({
      checks: { database: 'ok', queue: 'not_configured' },
      status: 'degraded',
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it('returns degraded readiness when the database is unavailable', async () => {
    const { HealthController } = await import('./health.controller.js');
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: (await import('../database/prisma.service.js'))
            .PrismaService,
          useValue: {
            $queryRaw: vi.fn().mockRejectedValue(new Error('offline')),
          },
        },
        {
          provide: (await import('../jobs/job-runner.service.js'))
            .JobRunnerService,
          useValue: { queueStatus: vi.fn().mockReturnValue('ready') },
        },
        {
          provide: (await import('../config/environment.module.js'))
            .ENVIRONMENT,
          useValue: { QUEUE_REQUIRED: true },
        },
      ],
    }).compile();

    const response = { status: vi.fn() };
    await expect(
      moduleRef.get(HealthController).ready(response),
    ).resolves.toEqual({
      checks: { database: 'unavailable', queue: 'ready' },
      status: 'degraded',
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
