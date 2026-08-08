import { Inject, Injectable } from '@nestjs/common';
import type { Plan, Prisma } from '../generated/prisma/client.js';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { effectivePlan } from './plan-entitlements.js';

/**
 * Resolves the effective plan for an organization. The canonical demo
 * workspace always runs on Pro so reviewers see full entitlements; real
 * workspaces read their synced subscription and default to Starter.
 */
@Injectable()
export class BillingStatusService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  async currentPlan(auth: AuthContext): Promise<Plan> {
    const membership = requireMembership(auth);
    const organizationId = membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) =>
        this.effectivePlanInTransaction(transaction, organizationId),
    );
  }

  /**
   * Effective plan computed inside a caller-owned tenant transaction, so
   * entitlement checks (team seats, imports) read the same snapshot as the
   * mutation they guard.
   */
  async effectivePlanInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<Plan> {
    const organization = await transaction.organization.findUnique({
      select: { isDemo: true },
      where: { id: organizationId },
    });
    if (organization?.isDemo) return 'PRO';
    const subscription = await transaction.organizationSubscription.findUnique({
      where: { organizationId },
    });
    return effectivePlan(subscription);
  }
}
