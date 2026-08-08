import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from './auth-context.js';
import { REQUIRED_PERMISSION } from './permission.decorator.js';
import { can, type Permission } from './rbac.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth.membership) {
      throw new ForbiddenException({
        code: 'WORKSPACE_MEMBERSHIP_REQUIRED',
        message: 'A workspace membership is required for this operation.',
      });
    }
    if (!can(request.auth.membership.role, permission)) {
      throw new ForbiddenException(
        `The ${request.auth.membership.role} role cannot perform this operation.`,
      );
    }

    return true;
  }
}
