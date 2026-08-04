import { ConflictException, Inject, Injectable } from '@nestjs/common';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { executeIdempotent } from '../idempotency/idempotency.js';

const RESET_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class DemoResetService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  reset(auth: AuthContext, idempotencyKey: string) {
    const organizationId = auth.membership.organization.id;
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
              if (!auth.membership.organization.isDemo) {
                throw new ConflictException(
                  'Only the demo organization can be reset.',
                );
              }
              await transaction.$executeRaw`
                SELECT stockpilot_reset_demo_data(${organizationId}::uuid)
              `;
              const now = new Date();
              const nextDemoResetAt = new Date(
                now.getTime() + RESET_INTERVAL_MS,
              );
              await transaction.organization.update({
                data: { nextDemoResetAt },
                where: { id: organizationId },
              });
              const resetEventId = organizationId;
              await recordAudit(transaction, {
                action: 'DEMO_RESET',
                actorUserId: auth.user.id,
                after: { nextDemoResetAt },
                entityId: resetEventId,
                entityType: 'Organization',
                organizationId,
              });
              return {
                nextDemoResetAt,
                resetAt: now,
                organizationId,
              };
            },
          }),
      )
      .then((result) => result.body);
  }
}
