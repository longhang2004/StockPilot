import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
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
  ) {}

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
}
