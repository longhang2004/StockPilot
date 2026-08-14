import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { PrismaService } from '../database/prisma.service.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import {
  findDemoFixtureActors,
  nextDemoResetAt,
  seedDemoFixture,
} from './demo-fixture.js';

@Injectable()
export class DemoResetService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Manual reset: authenticated tenant context, permission-gated by the
   * controller, idempotent, audited as DEMO_RESET with the requesting actor.
   */
  reset(auth: AuthContext, idempotencyKey: string) {
    const organizationId = requireMembership(auth).organization.id;
    return this.database
      .withTenant(
        { actorId: auth.user.id, organizationId },
        async (transaction) =>
          executeIdempotent(transaction, {
            key: idempotencyKey,
            organizationId,
            payload: { organizationId },
            responseStatus: 200,
            scope: 'organization:demo-reset',
            work: async () => {
              if (!requireMembership(auth).organization.isDemo) {
                throw new ConflictException(
                  'Only the demo organization can be reset.',
                );
              }
              await transaction.$executeRaw`
                SELECT stockpilot_reset_demo_data(${organizationId}::uuid)
              `;
              const now = new Date();
              const scheduledResetAt = nextDemoResetAt(now);
              const actors = await findDemoFixtureActors(
                transaction,
                organizationId,
              );
              await seedDemoFixture(transaction, {
                ...actors,
                force: true,
                organizationId,
              });
              const resetEventId = organizationId;
              await recordAudit(transaction, {
                action: 'DEMO_RESET',
                actorUserId: auth.user.id,
                after: { nextDemoResetAt: scheduledResetAt },
                entityId: resetEventId,
                entityType: 'Organization',
                organizationId,
              });
              await transaction.organization.update({
                data: { nextDemoResetAt: scheduledResetAt },
                where: { id: organizationId },
              });
              return {
                nextDemoResetAt: scheduledResetAt,
                resetAt: now,
                organizationId,
              };
            },
          }),
      )
      .then((result) => result.body);
  }

  /**
   * Automatic reset, checked before a demo login proceeds: no tenant
   * context exists yet (the caller has no session), so the work runs in a
   * plain transaction guarded by the demo-reset advisory lock, re-checks
   * the due time inside the lock, and is audited as DEMO_RESET_AUTOMATIC
   * under the demo owner actor. Distinct from the manual reset above:
   * this path never honors a client-supplied idempotency key.
   */
  async resetIfDue(organizationId: string): Promise<void> {
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
}
