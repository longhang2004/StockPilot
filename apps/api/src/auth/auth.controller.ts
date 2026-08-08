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
import { RoleSchema } from '@stockpilot/contracts';
import { z } from 'zod';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import type { AuthenticatedRequest } from './auth-context.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import {
  clearSessionCookie,
  setSessionCookie,
  type SessionCookieResponse,
} from './session-cookie.js';

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const SignupSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
});

const DemoLoginSchema = z.object({ role: RoleSchema });

const SwitchWorkspaceSchema = z.object({ organizationId: z.uuid() });

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const credentials = LoginSchema.parse(body);
    const result = await this.authService.login(
      credentials.email,
      credentials.password,
    );
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Public()
  @Post('signup')
  @HttpCode(201)
  async signup(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const credentials = SignupSchema.parse(body);
    const result = await this.authService.signup(credentials);
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Public()
  @Post('demo-login')
  @HttpCode(200)
  async demoLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const { role } = DemoLoginSchema.parse(body);
    const result = await this.authService.demoLogin(role);
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Get('session')
  session(@Req() request: AuthenticatedRequest) {
    return {
      membership: request.auth.membership,
      user: request.auth.user,
    };
  }

  @Get('workspaces')
  workspaces(@Req() request: AuthenticatedRequest) {
    return this.authService.listWorkspaces(request.auth);
  }

  @Post('switch-workspace')
  @HttpCode(200)
  async switchWorkspace(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const { organizationId } = SwitchWorkspaceSchema.parse(body);
    const result = await this.authService.switchWorkspace(
      request.auth,
      organizationId,
    );
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Get('csrf')
  csrf(@Req() request: AuthenticatedRequest) {
    return { csrfToken: this.authService.csrfToken(request.auth) };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ): Promise<void> {
    await this.authService.revokeSession(request.auth.sessionId);
    clearSessionCookie(this.environment, response);
  }
}
