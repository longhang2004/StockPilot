import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../database/prisma.service.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        checks: {
          database: 'ok' as const,
          queue: 'not_configured' as const,
        },
        status: 'ready' as const,
      };
    } catch {
      return {
        checks: {
          database: 'unavailable' as const,
          queue: 'not_configured' as const,
        },
        status: 'degraded' as const,
      };
    }
  }
}
