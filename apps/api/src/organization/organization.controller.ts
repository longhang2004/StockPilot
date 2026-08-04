import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { OrganizationService } from './organization.service.js';

@ApiTags('organization')
@Controller()
export class OrganizationController {
  constructor(
    @Inject(OrganizationService)
    private readonly organization: OrganizationService,
  ) {}

  @RequirePermission('organization:settings:read')
  @Get('organization/settings')
  settings(@Req() request: AuthenticatedRequest) {
    return this.organization.getSettings(request.auth);
  }

  @RequirePermission('team:read')
  @Get('team')
  team(@Req() request: AuthenticatedRequest) {
    return this.organization.listTeam(request.auth);
  }
}
