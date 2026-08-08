import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import {
  setSessionCookie,
  type SessionCookieResponse,
} from '../auth/session-cookie.js';
import { OrganizationService } from './organization.service.js';

const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

@ApiTags('organization')
@Controller()
export class OrganizationController {
  constructor(
    @Inject(OrganizationService)
    private readonly organization: OrganizationService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  /**
   * Authenticated but intentionally not permission-gated: a user with no
   * workspace yet (fresh signup) must be able to create their first one.
   */
  @Post('organizations')
  @HttpCode(201)
  async createWorkspace(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const { name } = CreateWorkspaceSchema.parse(body);
    const result = await this.organization.createWorkspace(request.auth, name);
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

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
