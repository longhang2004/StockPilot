import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { AnalyticsService } from './analytics.service.js';
import { SessionAuth } from '../openapi/security.decorator.js';

@ApiTags('analytics')
@Controller('analytics')
@SessionAuth()
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}

  @RequirePermission('analytics:read')
  @Get()
  overview(@Req() request: AuthenticatedRequest) {
    return this.analytics.analytics(request.auth);
  }
}
