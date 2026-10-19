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
      revision: this.revision(),
      service: 'stockpilot-api' as const,
      status: 'ok' as const,
    };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Dependency readiness checks.' })
  @ApiResponse({
    status: 503,
    description: 'A dependency is down or the database runtime role is unsafe.',
  })
  async ready(@Res({ passthrough: true }) response: HealthResponse) {
    const queue = this.jobs.queueStatus();
    const revision = this.revision();
    try {
      // Check the authenticated role too: SET ROLE must not hide an owner URL.
      const roles = await this.prisma.$queryRaw<
        { runtime_role_safe: boolean }[]
      >`
        SELECT NOT EXISTS (
          SELECT 1 FROM pg_roles privileged
          WHERE (privileged.rolsuper OR privileged.rolbypassrls
            OR privileged.rolcreaterole OR privileged.rolcreatedb)
            AND (pg_has_role(session_user, privileged.oid, 'MEMBER')
              OR pg_has_role(current_user, privileged.oid, 'MEMBER'))
        ) AS runtime_role_safe
      `;
      if (roles[0]?.runtime_role_safe !== true) {
        response.status(503);
        return {
          checks: { database: 'unsafe_role' as const, queue },
          rateLimit: this.rateLimit.stats(),
          revision,
          status: 'degraded' as const,
        };
      }
    } catch {
      response.status(503);
      return {
        checks: { database: 'unavailable' as const, queue },
        rateLimit: this.rateLimit.stats(),
        revision,
        status: 'degraded' as const,
      };
    }

    if (this.environment.QUEUE_REQUIRED && queue !== 'ready') {
      response.status(503);
      return {
        checks: { database: 'ok' as const, queue },
        rateLimit: this.rateLimit.stats(),
        revision,
        status: 'degraded' as const,
      };
    }

    return {
      checks: { database: 'ok' as const, queue },
      rateLimit: this.rateLimit.stats(),
      revision,
      status: 'ready' as const,
    };
  }

  /**
   * The deployed revision, so a release can be verified against the SHA that
   * passed CI. Render exposes RENDER_GIT_COMMIT; local runs report "local".
   */
  private revision(): string {
    return (
      process.env.RENDER_GIT_COMMIT ??
      process.env.API_REVISION ??
      'local-working-tree'
    );
  }
}
