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

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const DemoLoginSchema = z.object({ role: RoleSchema });

interface SessionCookieResponse {
  clearCookie(
    name: string,
    options: {
      httpOnly: boolean;
      path: string;
      sameSite: 'lax';
      secure: boolean;
    },
  ): void;
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      maxAge: number;
      path: string;
      sameSite: 'lax';
      secure: boolean;
    },
  ): void;
}

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
    this.setSessionCookie(response, result.rawToken);
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
    this.setSessionCookie(response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Get('session')
  session(@Req() request: AuthenticatedRequest) {
    return {
      membership: request.auth.membership,
      user: request.auth.user,
    };
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
    response.clearCookie(this.environment.SESSION_COOKIE_NAME, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: this.environment.NODE_ENV === 'production',
    });
  }

  private setSessionCookie(
    response: SessionCookieResponse,
    rawToken: string,
  ): void {
    response.cookie(this.environment.SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      maxAge: this.environment.SESSION_TTL_HOURS * 60 * 60 * 1000,
      path: '/',
      sameSite: 'lax',
      secure: this.environment.NODE_ENV === 'production',
    });
  }
}
