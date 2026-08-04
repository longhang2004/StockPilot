import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Role } from '@stockpilot/contracts';
import { verify } from 'argon2';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthContext } from './auth-context.js';
import {
  createSessionCredentials,
  deriveCsrfToken,
} from './session-credentials.js';

type MembershipWithIdentity = Awaited<
  ReturnType<AuthService['findDemoMembership']>
>;

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      where: { email: email.toLowerCase() },
    });
    const membership = user?.memberships[0];
    if (!user || !membership || !(await verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    return this.createSession({
      ...membership,
      user,
    });
  }

  async demoLogin(role: Role) {
    if (!this.environment.DEMO_MODE) {
      throw new UnauthorizedException('Demo login is disabled.');
    }
    const membership = await this.findDemoMembership(role);
    if (!membership) {
      throw new UnauthorizedException('Demo account is unavailable.');
    }

    return this.createSession(membership);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      data: { revokedAt: new Date() },
      where: { id: sessionId },
    });
  }

  csrfToken(context: AuthContext): string {
    return deriveCsrfToken(
      context.sessionTokenHash,
      this.environment.CSRF_SECRET,
    );
  }

  private findDemoMembership(role: Role) {
    return this.prisma.membership.findFirst({
      include: { organization: true, user: true },
      where: {
        organization: {
          isDemo: true,
          slug: this.environment.DEMO_ORGANIZATION_SLUG,
        },
        role,
      },
    });
  }

  private async createSession(membership: NonNullable<MembershipWithIdentity>) {
    const credentials = createSessionCredentials();
    const session = await this.prisma.session.create({
      data: {
        expiresAt: new Date(
          Date.now() + this.environment.SESSION_TTL_HOURS * 60 * 60 * 1000,
        ),
        membershipId: membership.id,
        tokenHash: credentials.tokenHash,
      },
    });

    return {
      context: {
        membership: {
          id: membership.id,
          organization: membership.organization,
          role: membership.role,
        },
        user: {
          displayName: membership.user.displayName,
          email: membership.user.email,
          id: membership.user.id,
        },
      },
      csrfToken: deriveCsrfToken(
        credentials.tokenHash,
        this.environment.CSRF_SECRET,
      ),
      rawToken: credentials.rawToken,
      session,
    };
  }
}
