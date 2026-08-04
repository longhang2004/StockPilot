import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import type { AuthenticatedRequest } from './auth-context.js';
import { CSRF_EXEMPT_ROUTE } from './csrf-exempt.decorator.js';
import { verifyCsrfToken } from './session-credentials.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isExempt = this.reflector.getAllAndOverride<boolean>(
      CSRF_EXEMPT_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isExempt) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (safeMethods.has(request.method)) {
      return true;
    }

    if (request.get('origin') !== this.environment.WEB_ORIGIN) {
      throw new ForbiddenException('Request origin is not allowed.');
    }

    if (!request.auth) {
      return true;
    }

    const candidate = request.get('x-csrf-token');
    if (
      !candidate ||
      !verifyCsrfToken(
        candidate,
        request.auth.sessionTokenHash,
        this.environment.CSRF_SECRET,
      )
    ) {
      throw new ForbiddenException('CSRF token is missing or invalid.');
    }

    return true;
  }
}
