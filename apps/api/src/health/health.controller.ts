import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator.js';
import { RateLimitGuard } from '../auth/rate-limit.guard.js';
import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { JobRunnerService } from '../jobs/job-runner.service.js';

interface HealthResponse {
  status(code: number): void;
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobRunnerService) private readonly jobs: JobRunnerService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(RateLimitGuard) private readonly rateLimit: RateLimitGuard,
  ) {}

  @Get('live')
  @ApiOkResponse({ description: 'The API process is running.' })
  live() {
    return {
      service: 'stockpilot-api' as const,
      status: 'ok' as const,
    };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Dependency readiness checks.' })
  @ApiResponse({ status: 503, description: 'A required dependency is down.' })
  async ready(@Res({ passthrough: true }) response: HealthResponse) {
    const queue = this.jobs.queueStatus();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      response.status(503);
      return {
        checks: { database: 'unavailable' as const, queue },
        rateLimit: this.rateLimit.stats(),
        status: 'degraded' as const,
      };
    }

    if (this.environment.QUEUE_REQUIRED && queue !== 'ready') {
      response.status(503);
      return {
        checks: { database: 'ok' as const, queue },
        rateLimit: this.rateLimit.stats(),
        status: 'degraded' as const,
      };
    }

    return {
      checks: { database: 'ok' as const, queue },
      rateLimit: this.rateLimit.stats(),
      status: 'ready' as const,
    };
  }
}
