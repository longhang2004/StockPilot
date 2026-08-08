import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role } from '@stockpilot/contracts';
import { randomBytes } from 'node:crypto';

import { recordAudit } from '../audit/audit-record.js';
import { AuthService } from '../auth/auth.service.js';
import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { hashSessionToken } from '../auth/session-credentials.js';
import { BillingStatusService } from '../billing/billing-status.service.js';
import { entitlementsFor } from '../billing/plan-entitlements.js';
import { PrismaService } from '../database/prisma.service.js';
import { TenantDatabase } from '../database/tenant-database.js';

const INVITATION_TTL_DAYS = 7;

interface ResolvedInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: Role;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
}

@Injectable()
export class TeamService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(BillingStatusService)
    private readonly billingStatus: BillingStatusService,
  ) {}

  /**
   * Creates a pending invitation. The raw token is returned exactly once so
   * the inviter can share the accept link (the project has no email
   * transport); only its SHA-256 hash is ever persisted, and audit metadata
   * never contains the token.
   */
  invite(auth: AuthContext, input: { email: string; role: Role }) {
    const membership = requireMembership(auth);
    if (input.role === 'OWNER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE_CHANGE',
        message: 'Invitations can only grant Manager or Staff roles.',
      });
    }
    const email = input.email.toLowerCase();
    const organizationId = membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        // Serialize all team-seat mutations for this workspace so the
        // membership+pending seat accounting below cannot race.
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${`team:${organizationId}`}, 0))
        `;
        const plan = await this.billingStatus.effectivePlanInTransaction(
          transaction,
          organizationId,
        );
        const { maxTeamMembers } = entitlementsFor(plan);
        const [memberCount, pendingCount] = await Promise.all([
          transaction.membership.count({ where: { organizationId } }),
          transaction.organizationInvitation.count({
            where: {
              acceptedAt: null,
              expiresAt: { gt: new Date() },
              organizationId,
              revokedAt: null,
            },
          }),
        ]);
        if (memberCount + pendingCount >= maxTeamMembers) {
          throw new ConflictException({
            code: 'PLAN_LIMIT_REACHED',
            message: `The ${plan} plan supports up to ${maxTeamMembers} team members. Upgrade to add more.`,
          });
        }
        const existingMember = await transaction.membership.findFirst({
          select: { id: true },
          where: { organizationId, user: { email } },
        });
        if (existingMember) {
          throw new ConflictException({
            code: 'ALREADY_A_MEMBER',
            message: `${email} is already a member of this workspace.`,
          });
        }
        const pending = await transaction.organizationInvitation.findFirst({
          where: {
            acceptedAt: null,
            email,
            organizationId,
            revokedAt: null,
          },
        });
        if (pending) {
          if (pending.expiresAt.getTime() <= Date.now()) {
            // An expired invitation can never be accepted: revoke it so the
            // email's pending slot (and the seat it occupies) frees up.
            await transaction.organizationInvitation.update({
              data: { revokedAt: new Date() },
              where: { id: pending.id },
            });
          } else {
            throw new ConflictException({
              code: 'INVITATION_ALREADY_PENDING',
              message: `An invitation for ${email} is already pending.`,
            });
          }
        }
        const rawToken = randomBytes(32).toString('base64url');
        const invitation = await transaction.organizationInvitation.create({
          data: {
            email,
            expiresAt: new Date(
              Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
            ),
            invitedByUserId: auth.user.id,
            organizationId,
            role: input.role,
            tokenHash: hashSessionToken(rawToken),
          },
        });
        await recordAudit(transaction, {
          action: 'TEAM_MEMBER_INVITED',
          actorUserId: auth.user.id,
          after: { expiresAt: invitation.expiresAt },
          before: { email, role: input.role },
          entityId: invitation.id,
          entityType: 'OrganizationInvitation',
          organizationId,
        });
        return {
          createdAt: invitation.createdAt,
          email,
          expiresAt: invitation.expiresAt,
          id: invitation.id,
          rawToken,
          role: input.role,
        };
      },
    );
  }

  listInvitations(auth: AuthContext) {
    const membership = requireMembership(auth);
    const organizationId = membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) =>
        transaction.organizationInvitation.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            createdAt: true,
            email: true,
            expiresAt: true,
            id: true,
            role: true,
          },
          where: { acceptedAt: null, revokedAt: null },
        }),
    );
  }

  revokeInvitation(auth: AuthContext, invitationId: string) {
    const membership = requireMembership(auth);
    const organizationId = membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const invitation = await transaction.organizationInvitation.findUnique({
          where: { id: invitationId },
        });
        if (!invitation || invitation.acceptedAt !== null) {
          throw new NotFoundException({
            code: 'INVITATION_NOT_FOUND',
            message: 'This invitation no longer exists.',
          });
        }
        if (invitation.revokedAt !== null) {
          return {
            email: invitation.email,
            id: invitation.id,
            revokedAt: invitation.revokedAt,
          };
        }
        const revokedAt = new Date();
        await transaction.organizationInvitation.update({
          data: { revokedAt },
          where: { id: invitationId },
        });
        await recordAudit(transaction, {
          action: 'INVITATION_REVOKED',
          actorUserId: auth.user.id,
          after: { revokedAt },
          before: { email: invitation.email, role: invitation.role },
          entityId: invitationId,
          entityType: 'OrganizationInvitation',
          organizationId,
        });
        return { email: invitation.email, id: invitation.id, revokedAt };
      },
    );
  }

  /**
   * Accepts an invitation by token. The lookup runs through a narrow
   * SECURITY DEFINER function because the invitee has no membership yet and
   * therefore no tenant context for RLS; every mutation afterwards happens in
   * a tenant-scoped transaction under the invitation's own organization.
   */
  async acceptInvitation(auth: AuthContext, token: string) {
    const tokenHash = hashSessionToken(token);
    const rows = await this.prisma.$queryRaw<ResolvedInvitation[]>`
      SELECT *
        FROM stockpilot_resolve_invitation(${tokenHash}::char(64))
    `;
    const invitation = rows[0];
    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'This invitation link is invalid.',
      });
    }
    this.assertAcceptable(invitation);
    if (invitation.email !== auth.user.email.toLowerCase()) {
      throw new ForbiddenException({
        code: 'INVITATION_EMAIL_MISMATCH',
        message: 'This invitation was sent to a different email address.',
      });
    }
    const membership = await this.database.withTenant(
      { actorId: auth.user.id, organizationId: invitation.organization_id },
      async (transaction) => {
        // Serialize with invite/role/removal mutations for this workspace:
        // the seat re-check and the membership creation must not race.
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${`team:${invitation.organization_id}`}, 0))
        `;
        const current = await transaction.organizationInvitation.findUnique({
          where: { id: invitation.id },
        });
        if (!current) {
          throw new NotFoundException({
            code: 'INVITATION_NOT_FOUND',
            message: 'This invitation no longer exists.',
          });
        }
        this.assertAcceptable({
          accepted_at: current.acceptedAt,
          email: current.email,
          expires_at: current.expiresAt,
          id: current.id,
          organization_id: current.organizationId,
          revoked_at: current.revokedAt,
          role: current.role,
        });
        const alreadyMember = await transaction.membership.findFirst({
          where: {
            organizationId: current.organizationId,
            userId: auth.user.id,
          },
        });
        if (alreadyMember) {
          throw new ConflictException({
            code: 'ALREADY_A_MEMBER',
            message: 'You are already a member of this workspace.',
          });
        }
        // Re-check the effective seat limit inside the acceptance
        // transaction: an invitation issued while seats existed may have
        // become unusable if the workspace filled up first.
        const plan = await this.billingStatus.effectivePlanInTransaction(
          transaction,
          current.organizationId,
        );
        const { maxTeamMembers } = entitlementsFor(plan);
        const memberCount = await transaction.membership.count({
          where: { organizationId: current.organizationId },
        });
        if (memberCount >= maxTeamMembers) {
          throw new ConflictException({
            code: 'PLAN_LIMIT_REACHED',
            message: `The ${plan} plan supports up to ${maxTeamMembers} team members. This invitation can no longer be accepted.`,
          });
        }
        const created = await transaction.membership.create({
          data: {
            organizationId: current.organizationId,
            role: current.role,
            userId: auth.user.id,
          },
          include: { organization: true, user: true },
        });
        await transaction.organizationInvitation.update({
          data: { acceptedAt: new Date() },
          where: { id: current.id },
        });
        await recordAudit(transaction, {
          action: 'INVITATION_ACCEPTED',
          actorUserId: auth.user.id,
          after: { membershipId: created.id, role: created.role },
          before: { email: current.email },
          entityId: current.id,
          entityType: 'OrganizationInvitation',
          organizationId: current.organizationId,
        });
        return created;
      },
    );
    return this.authService.issueSession(membership, auth.user);
  }

  changeMemberRole(auth: AuthContext, membershipId: string, newRole: Role) {
    const membership = requireMembership(auth);
    const organizationId = membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        // Serialize owner-count check + mutation per workspace: two
        // concurrent demotions of the only two Owners must not both pass.
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${`team:${organizationId}`}, 0))
        `;
        // memberships is not RLS-protected, so the organization id must be
        // part of the query: a bare id lookup would allow cross-tenant
        // role changes.
        const target = await transaction.membership.findFirst({
          include: { user: { select: { displayName: true, email: true } } },
          where: { id: membershipId, organizationId },
        });
        if (!target) {
          throw new NotFoundException({
            code: 'MEMBER_NOT_FOUND',
            message: 'This team member no longer exists.',
          });
        }
        const ownerCount = await transaction.membership.count({
          where: { organizationId, role: 'OWNER' },
        });
        if (target.role === 'OWNER' && newRole !== 'OWNER' && ownerCount <= 1) {
          throw new ConflictException({
            code: 'LAST_OWNER_REQUIRED',
            message: 'The workspace must keep at least one Owner.',
          });
        }
        if (target.role === newRole) {
          return {
            displayName: target.user.displayName,
            email: target.user.email,
            id: target.id,
            role: newRole,
          };
        }
        await transaction.membership.update({
          data: { role: newRole },
          where: { id: membershipId },
        });
        await recordAudit(transaction, {
          action: 'TEAM_MEMBER_ROLE_CHANGED',
          actorUserId: auth.user.id,
          after: { role: newRole },
          before: { email: target.user.email, role: target.role },
          entityId: membershipId,
          entityType: 'Membership',
          organizationId,
        });
        return {
          displayName: target.user.displayName,
          email: target.user.email,
          id: target.id,
          role: newRole,
        };
      },
    );
  }

  removeMember(auth: AuthContext, membershipId: string) {
    const membership = requireMembership(auth);
    const organizationId = membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        // Same per-workspace serialization as role changes: the
        // owner-count check and the deletion must be atomic.
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${`team:${organizationId}`}, 0))
        `;
        // See changeMemberRole: memberships has no RLS, so scope by org.
        const target = await transaction.membership.findFirst({
          include: { user: { select: { displayName: true, email: true } } },
          where: { id: membershipId, organizationId },
        });
        if (!target) {
          throw new NotFoundException({
            code: 'MEMBER_NOT_FOUND',
            message: 'This team member no longer exists.',
          });
        }
        const ownerCount = await transaction.membership.count({
          where: { organizationId, role: 'OWNER' },
        });
        if (target.role === 'OWNER' && ownerCount <= 1) {
          throw new ConflictException({
            code: 'LAST_OWNER_REQUIRED',
            message: 'The workspace must keep at least one Owner.',
          });
        }
        await transaction.membership.delete({ where: { id: membershipId } });
        await recordAudit(transaction, {
          action: 'TEAM_MEMBER_REMOVED',
          actorUserId: auth.user.id,
          before: {
            displayName: target.user.displayName,
            email: target.user.email,
            role: target.role,
          },
          entityId: membershipId,
          entityType: 'Membership',
          organizationId,
        });
        return {
          email: target.user.email,
          id: target.id,
          removedAt: new Date(),
        };
      },
    );
  }

  private assertAcceptable(invitation: ResolvedInvitation): void {
    if (invitation.revoked_at !== null) {
      throw new ConflictException({
        code: 'INVITATION_REVOKED',
        message: 'This invitation has been revoked.',
      });
    }
    if (invitation.accepted_at !== null) {
      throw new ConflictException({
        code: 'INVITATION_ALREADY_ACCEPTED',
        message: 'This invitation has already been accepted.',
      });
    }
    if (invitation.expires_at.getTime() <= Date.now()) {
      throw new ConflictException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired.',
      });
    }
  }
}
