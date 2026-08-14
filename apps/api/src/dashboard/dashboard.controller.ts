import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { SessionAuth } from '../openapi/security.decorator.js';

@ApiTags('dashboard')
@Controller('dashboard')
@SessionAuth()
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @RequirePermission('inventory:read')
  @Get('overview')
  overview(@Req() request: AuthenticatedRequest) {
    return this.dashboard.overview(request.auth);
  }
}
