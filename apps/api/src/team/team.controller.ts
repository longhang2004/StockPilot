import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleSchema } from '@stockpilot/contracts';
import { z } from 'zod';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import {
  setSessionCookie,
  type SessionCookieResponse,
} from '../auth/session-cookie.js';
import { TeamService } from './team.service.js';

const InviteSchema = z.object({
  email: z.email(),
  role: RoleSchema,
});

const AcceptSchema = z.object({
  token: z.string().trim().min(32).max(128),
});

const ChangeRoleSchema = z.object({ role: RoleSchema });

@ApiTags('team')
@Controller('team')
export class TeamController {
  constructor(
    @Inject(TeamService) private readonly team: TeamService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  @RequirePermission('team:invite')
  @Post('invitations')
  invite(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.team.invite(request.auth, InviteSchema.parse(body));
  }

  @RequirePermission('team:read')
  @Get('invitations')
  invitations(@Req() request: AuthenticatedRequest) {
    return this.team.listInvitations(request.auth);
  }

  @RequirePermission('team:invite')
  @Post('invitations/:id/revoke')
  @HttpCode(200)
  revoke(
    @Param('id', ParseUUIDPipe) invitationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.team.revokeInvitation(request.auth, invitationId);
  }

  /**
   * Authenticated but not permission-gated: the invitee may hold no
   * membership yet. On success a fresh session is issued for the joined
   * workspace, mirroring the login response shape.
   */
  @Post('invitations/accept')
  @HttpCode(200)
  async accept(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const { token } = AcceptSchema.parse(body);
    const result = await this.team.acceptInvitation(request.auth, token);
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @RequirePermission('team:write')
  @Patch('members/:membershipId/role')
  changeRole(
    @Body() body: unknown,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.team.changeMemberRole(
      request.auth,
      membershipId,
      ChangeRoleSchema.parse(body).role,
    );
  }

  @RequirePermission('team:write')
  @Delete('members/:membershipId')
  @HttpCode(200)
  remove(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.team.removeMember(request.auth, membershipId);
  }
}
