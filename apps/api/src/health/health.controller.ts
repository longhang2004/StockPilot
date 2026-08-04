import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
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
  ready() {
    return {
      checks: {
        database: 'pending' as const,
        queue: 'pending' as const,
      },
      status: 'ready' as const,
    };
  }
}
