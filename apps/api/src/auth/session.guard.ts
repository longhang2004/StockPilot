import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleSchema } from '@stockpilot/contracts';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedRequest } from './auth-context.js';
import { IS_PUBLIC_ROUTE } from './public.decorator.js';
import { hashSessionToken } from './session-credentials.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = request.cookies?.[this.environment.SESSION_COOKIE_NAME];
    if (!rawToken) {
      throw new UnauthorizedException('Authentication required.');
    }

    const tokenHash = hashSessionToken(rawToken);
    const session = await this.prisma.session.findUnique({
      include: {
        membership: {
          include: { organization: true, user: true },
        },
        user: true,
      },
      where: { tokenHash },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is invalid or expired.');
    }

    const { membership } = session;
    request.auth = {
      membership: membership
        ? {
            id: membership.id,
            organization: {
              currency: membership.organization.currency,
              id: membership.organization.id,
              isDemo: membership.organization.isDemo,
              name: membership.organization.name,
              nextDemoResetAt: membership.organization.nextDemoResetAt,
              slug: membership.organization.slug,
            },
            role: RoleSchema.parse(membership.role),
          }
        : null,
      sessionId: session.id,
      sessionTokenHash: tokenHash,
      user: {
        displayName: session.user.displayName,
        email: session.user.email,
        id: session.user.id,
      },
    };

    return true;
  }
}
