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
import { DemoResetService } from '../demo/demo-reset.service.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import type { AuthContext } from './auth-context.js';
import {
  createSessionCredentials,
  deriveCsrfToken,
} from './session-credentials.js';

/**
 * A valid argon2 hash of a throwaway string, verified when the submitted
 * email does not exist. Without it, unknown-email logins return in
 * microseconds while known-email logins take a full hash computation,
 * letting a remote client enumerate accounts by response time.
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$xEh+X58Gp6+A2iFCc618NQ$N9i9H1PcfuJLm+qMooqd0P7/GRntQAVSgJa/FEKef0g';

type MembershipWithIdentity = Awaited<
  ReturnType<AuthService['findDemoMembership']>
>;

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemoResetService) private readonly demoReset: DemoResetService,
    @Inject(AuthThrottleService) private readonly authThrottle: AuthThrottleService,
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

  async login(email: string, password: string, clientAddress: string) {
    // Blocked pairs never reach the database or the password hash.
    this.authThrottle.checkAttempt(email, clientAddress);

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
    if (!user) {
      // Equalize response time with the known-user path so account
      // existence cannot be inferred from latency (see DUMMY_PASSWORD_HASH).
      await verify(DUMMY_PASSWORD_HASH, password);
      this.authThrottle.recordFailure(email, clientAddress);
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    if (!(await verify(user.passwordHash, password))) {
      this.authThrottle.recordFailure(email, clientAddress);
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    // A successful sign-in clears prior failures for this pair so the
    // account owner is never locked out by their own mistakes.
    this.authThrottle.clearFailures(email, clientAddress);
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
      // The demo domain owns reset mechanics; auth only checks whether a
      // reset is due and continues the login flow once it is done.
      await this.demoReset.resetIfDue(membership.organization.id);
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

  /**
   * Creates a fresh session (and cookie payload) for a user, optionally bound
   * to a workspace membership. Used by login, signup, demo login, workspace
   * switching, invitation acceptance, and workspace creation.
   */
  async issueSession(
    membership: MembershipWithIdentity | null,
    user: { displayName: string; email: string; id: string },
  ) {
    // Session hygiene (per user, before the new session is created):
    // expired rows are dropped so the table cannot grow without bound, and
    // the oldest active sessions beyond MAX_ACTIVE_SESSIONS_PER_USER are
    // revoked so one credential pair cannot accumulate an unbounded
    // session surface.
    const now = new Date();
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: now }, userId: user.id },
    });
    const activeSessions = await this.prisma.session.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      where: { expiresAt: { gt: now }, revokedAt: null, userId: user.id },
    });
    const excess =
      activeSessions.length - this.environment.MAX_ACTIVE_SESSIONS_PER_USER;
    if (excess > 0) {
      await this.prisma.session.updateMany({
        data: { revokedAt: now },
        where: {
          id: {
            in: activeSessions.slice(0, excess).map((session) => session.id),
          },
        },
      });
    }

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
