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
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { resolveRequestClientAddress } from './client-address.js';
import { schemaRef } from '../openapi/schemas.js';
import type { AuthenticatedRequest } from './auth-context.js';
import {
  DemoLoginInputSchema,
  LoginInputSchema,
  SignupInputSchema,
  SwitchWorkspaceInputSchema,
} from './auth-schemas.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import {
  clearSessionCookie,
  setSessionCookie,
  type SessionCookieResponse,
} from './session-cookie.js';
import {
  SessionAuth,
  SessionAuthWrite,
} from '../openapi/security.decorator.js';

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
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Sets the HttpOnly session cookie and returns the session context plus a CSRF token for browser writes.',
  })
  @ApiOkResponse({
    description: 'Session context with CSRF token; session cookie is set.',
    schema: schemaRef('AuthSessionResult'),
  })
  @ApiBody({ schema: schemaRef('LoginInput') })
  async login(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const credentials = LoginInputSchema.parse(body);
    const result = await this.authService.login(
      credentials.email,
      credentials.password,
      // Same trust rules as the rate-limit guard, so the per-account
      // brute-force throttle keys on the same client identity.
      resolveRequestClientAddress(request, this.environment).address,
    );
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Public()
  @Post('signup')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Creates a user, sets the session cookie, and returns the session context. The user has no workspace until one is created or an invitation is accepted.',
  })
  @ApiCreatedResponse({
    description: 'Session context with CSRF token; session cookie is set.',
    schema: schemaRef('AuthSessionResult'),
  })
  @ApiBody({ schema: schemaRef('SignupInput') })
  async signup(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const credentials = SignupInputSchema.parse(body);
    const result = await this.authService.signup(credentials);
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Public()
  @Post('demo-login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'One-click demo login',
    description:
      'DEMO_MODE only. Logs into the canonical seeded demo organization as the requested role.',
  })
  @ApiOkResponse({
    description: 'Session context with CSRF token; session cookie is set.',
    schema: schemaRef('AuthSessionResult'),
  })
  @ApiBody({ schema: schemaRef('DemoLoginInput') })
  async demoLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const { role } = DemoLoginInputSchema.parse(body);
    const result = await this.authService.demoLogin(role);
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Get('session')
  @SessionAuth()
  @ApiOperation({
    summary: 'Current session',
    description:
      'Returns the authenticated user and their active workspace membership, if any.',
  })
  @ApiOkResponse({
    description: 'Authenticated user and membership.',
    schema: schemaRef('SessionInfo'),
  })
  session(@Req() request: AuthenticatedRequest) {
    return {
      membership: request.auth.membership,
      user: request.auth.user,
    };
  }

  @Get('workspaces')
  @SessionAuth()
  workspaces(@Req() request: AuthenticatedRequest) {
    return this.authService.listWorkspaces(request.auth);
  }

  @Post('switch-workspace')
  @SessionAuthWrite()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Switch the active workspace',
    description:
      'Verifies membership server-side before binding a fresh session to the requested organization.',
  })
  @ApiOkResponse({
    description:
      'Session context for the new workspace; session cookie is replaced.',
    schema: schemaRef('AuthSessionResult'),
  })
  @ApiBody({ schema: schemaRef('SwitchWorkspaceInput') })
  async switchWorkspace(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ) {
    const { organizationId } = SwitchWorkspaceInputSchema.parse(body);
    const result = await this.authService.switchWorkspace(
      request.auth,
      organizationId,
    );
    setSessionCookie(this.environment, response, result.rawToken);
    return { ...result.context, csrfToken: result.csrfToken };
  }

  @Get('csrf')
  @SessionAuth()
  csrf(@Req() request: AuthenticatedRequest) {
    return { csrfToken: this.authService.csrfToken(request.auth) };
  }

  @Post('logout')
  @SessionAuthWrite()
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: SessionCookieResponse,
  ): Promise<void> {
    await this.authService.revokeSession(request.auth.sessionId);
    clearSessionCookie(this.environment, response);
  }
}
