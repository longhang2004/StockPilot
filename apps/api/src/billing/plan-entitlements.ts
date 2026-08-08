import type { Plan, SubscriptionStatus } from '../generated/prisma/client.js';

export interface PlanEntitlements {
  csvImport: boolean;
  integrations: boolean;
  maxTeamMembers: number;
}

export const PLAN_ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  STARTER: {
    csvImport: false,
    integrations: false,
    maxTeamMembers: 3,
  },
  PRO: {
    csvImport: true,
    integrations: true,
    maxTeamMembers: 20,
  },
};

export function entitlementsFor(plan: Plan): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan];
}

/**
 * Billing policy: which subscription states grant the stored plan's paid
 * entitlements.
 *
 * - No subscription row            -> Starter (nothing paid).
 * - ACTIVE / TRIALING              -> the stored plan (Stripe confirmed it).
 * - INCOMPLETE                     -> Starter: requesting Checkout or a
 *   half-finished payment never grants paid entitlements.
 * - PAST_DUE / UNPAID / CANCELED   -> Starter: entitlement lapses until an
 *   eligible state is re-confirmed by a webhook.
 * - Unknown status                 -> Starter (fail safe, never unlock Pro).
 *
 * Checkout itself only ever stores `INCOMPLETE`; only webhook synchronization
 * can move a subscription into an eligible state, so no client request can
 * directly choose a paid plan.
 */
const ELIGIBLE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'ACTIVE',
  'TRIALING',
]);

export function effectivePlan(
  subscription: { plan: Plan; status: SubscriptionStatus } | null,
): Plan {
  if (!subscription) return 'STARTER';
  return ELIGIBLE_STATUSES.has(subscription.status)
    ? subscription.plan
    : 'STARTER';
}
