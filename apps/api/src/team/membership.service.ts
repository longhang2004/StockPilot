import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role } from '@stockpilot/contracts';

import { recordAudit } from '../audit/audit-record.js';
import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { TenantDatabase } from '../database/tenant-database.js';

/**
 * Membership lifecycle: role changes and removals. Owner-count protection is
 * enforced inside the same per-workspace advisory-lock transaction as the
 * mutation, so two concurrent demotions/removals of the last two Owners can
 * never both succeed.
 */
@Injectable()
export class MembershipService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

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
}
