import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RATE_LIMIT_STATS = {
  buckets: 0,
  rejected: { public: 0, auth: 0, user: 0 },
  limits: {
    publicWritesPerMinute: 60,
    authWritesPerMinute: 60,
    userWritesPerMinute: 240,
  },
};

const TEST_REVISION = 'ci-test-revision';

describe('HealthController', () => {
  beforeEach(() => {
    vi.stubEnv('RENDER_GIT_COMMIT', TEST_REVISION);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
        {
          provide: (await import('../auth/rate-limit.guard.js')).RateLimitGuard,
          useValue: { stats: () => RATE_LIMIT_STATS },
        },
      ],
    }).compile();

    expect(moduleRef.get(HealthController).live()).toEqual({
      revision: TEST_REVISION,
      service: 'stockpilot-api',
      status: 'ok',
    });
  });

  it('requires a safe runtime role before reporting readiness', async () => {
    const { HealthController } = await import('./health.controller.js');
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ runtime_role_safe: true }]),
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
        {
          provide: (await import('../auth/rate-limit.guard.js')).RateLimitGuard,
          useValue: { stats: () => RATE_LIMIT_STATS },
        },
      ],
    }).compile();

    const response = { status: vi.fn() };
    await expect(
      moduleRef.get(HealthController).ready(response),
    ).resolves.toEqual({
      checks: { database: 'ok', queue: 'not_configured' },
      rateLimit: RATE_LIMIT_STATS,
      revision: TEST_REVISION,
      status: 'ready',
    });
    expect(response.status).not.toHaveBeenCalled();

    for (const rows of [[{ runtime_role_safe: false }], []]) {
      prisma.$queryRaw.mockResolvedValueOnce(rows);
      await expect(
        moduleRef.get(HealthController).ready(response),
      ).resolves.toMatchObject({
        checks: { database: 'unsafe_role', queue: 'not_configured' },
        status: 'degraded',
      });
      expect(response.status).toHaveBeenLastCalledWith(503);
    }
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
            $queryRaw: vi.fn().mockResolvedValue([{ runtime_role_safe: true }]),
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
        {
          provide: (await import('../auth/rate-limit.guard.js')).RateLimitGuard,
          useValue: { stats: () => RATE_LIMIT_STATS },
        },
      ],
    }).compile();

    const response = { status: vi.fn() };
    await expect(
      moduleRef.get(HealthController).ready(response),
    ).resolves.toEqual({
      checks: { database: 'ok', queue: 'not_configured' },
      rateLimit: RATE_LIMIT_STATS,
      revision: TEST_REVISION,
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
        {
          provide: (await import('../auth/rate-limit.guard.js')).RateLimitGuard,
          useValue: { stats: () => RATE_LIMIT_STATS },
        },
      ],
    }).compile();

    const response = { status: vi.fn() };
    await expect(
      moduleRef.get(HealthController).ready(response),
    ).resolves.toEqual({
      checks: { database: 'unavailable', queue: 'ready' },
      rateLimit: RATE_LIMIT_STATS,
      revision: TEST_REVISION,
      status: 'degraded',
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
