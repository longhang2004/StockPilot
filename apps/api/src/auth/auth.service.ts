import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Role } from '@stockpilot/contracts';
import { hash, verify } from 'argon2';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { recordAudit } from '../audit/audit-record.js';
import {
  findDemoFixtureActors,
  nextDemoResetAt,
  seedDemoFixture,
} from '../demo/demo-fixture.js';
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

  async signup(input: {
    displayName: string;
    email: string;
    password: string;
  }) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      });
    }
    const passwordHash = await hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        displayName: input.displayName.trim(),
        email,
        passwordHash,
      },
    });
    return this.issueSession(null, user);
  }

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
    if (!user || !(await verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    const membership = user.memberships[0] ?? null;
    return this.issueSession(membership ? { ...membership, user } : null, user);
  }

  async demoLogin(role: Role) {
    if (!this.environment.DEMO_MODE) {
      throw new UnauthorizedException('Demo login is disabled.');
    }
    let membership = await this.findDemoMembership(role);
    if (!membership) {
      throw new UnauthorizedException('Demo account is unavailable.');
    }

    if (
      membership.organization.nextDemoResetAt &&
      membership.organization.nextDemoResetAt.getTime() <= Date.now()
    ) {
      await this.resetDueDemoOrganization(membership.organization.id);
      membership = await this.findDemoMembership(role);
      if (!membership) {
        throw new UnauthorizedException('Demo account is unavailable.');
      }
    }

    return this.issueSession(membership, membership.user);
  }

  /** Memberships the authenticated user holds across workspaces. */
  listWorkspaces(auth: AuthContext) {
    return this.prisma.membership.findMany({
      include: { organization: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      where: { userId: auth.user.id },
    });
  }

  /**
   * Binds a fresh session to the requested workspace. The browser-supplied
   * organization id is only a destination: membership is verified server-side
   * before any session is created.
   */
  async switchWorkspace(auth: AuthContext, organizationId: string) {
    const membership = await this.prisma.membership.findFirst({
      include: { organization: true, user: true },
      where: { organizationId, userId: auth.user.id },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'INVALID_WORKSPACE_MEMBERSHIP',
        message: 'You are not a member of this workspace.',
      });
    }
    return this.issueSession(membership, membership.user);
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

  private async resetDueDemoOrganization(
    organizationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`demo-reset:${organizationId}`}, 0))
      `;
      const organization = await transaction.organization.findUnique({
        select: { isDemo: true, nextDemoResetAt: true },
        where: { id: organizationId },
      });
      if (
        !organization?.isDemo ||
        !organization.nextDemoResetAt ||
        organization.nextDemoResetAt.getTime() > Date.now()
      ) {
        return;
      }
      await transaction.$executeRaw`
        SELECT set_config('app.current_org_id', ${organizationId}, true)
      `;
      await transaction.$executeRaw`
        SELECT set_config('app.current_actor_id', '', true)
      `;
      await transaction.$executeRaw`
        SELECT stockpilot_reset_demo_data(${organizationId}::uuid)
      `;
      const actors = await findDemoFixtureActors(transaction, organizationId);
      await transaction.$executeRaw`
        SELECT set_config('app.current_actor_id', ${actors.ownerUserId}, true)
      `;
      await seedDemoFixture(transaction, {
        ...actors,
        force: true,
        organizationId,
      });
      const scheduledResetAt = nextDemoResetAt();
      await recordAudit(transaction, {
        action: 'DEMO_RESET_AUTOMATIC',
        actorUserId: actors.ownerUserId,
        after: { nextDemoResetAt: scheduledResetAt },
        entityId: organizationId,
        entityType: 'Organization',
        organizationId,
      });
      await transaction.organization.update({
        data: { nextDemoResetAt: scheduledResetAt },
        where: { id: organizationId },
      });
    });
  }

  /**
   * Creates a fresh session (and cookie payload) for a user, optionally bound
   * to a workspace membership. Used by login, signup, demo login, workspace
   * switching, invitation acceptance, and workspace creation.
   */
  async issueSession(
    membership: MembershipWithIdentity | null,
    user: { displayName: string; email: string; id: string },
  ) {
    const credentials = createSessionCredentials();
    const session = await this.prisma.session.create({
      data: {
        expiresAt: new Date(
          Date.now() + this.environment.SESSION_TTL_HOURS * 60 * 60 * 1000,
        ),
        membershipId: membership?.id ?? null,
        tokenHash: credentials.tokenHash,
        userId: user.id,
      },
    });

    return {
      context: {
        membership: membership
          ? {
              id: membership.id,
              organization: membership.organization,
              role: membership.role,
            }
          : null,
        user: {
          displayName: user.displayName,
          email: user.email,
          id: user.id,
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
