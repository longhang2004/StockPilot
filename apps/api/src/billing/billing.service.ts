import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Plan } from '../generated/prisma/client.js';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { effectivePlan, entitlementsFor } from './plan-entitlements.js';
import {
  StripeClient,
  type StripeSubscriptionEventObject,
  type StripeWebhookEvent,
} from './stripe-client.js';

export interface BillingStatusView {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  entitlements: {
    csvImport: boolean;
    integrations: boolean;
    maxTeamMembers: number;
  };
  isDemoBilling: boolean;
  plan: Plan;
  status:
    | 'ACTIVE'
    | 'CANCELED'
    | 'INCOMPLETE'
    | 'PAST_DUE'
    | 'TRIALING'
    | 'UNPAID'
    | null;
  teamUsage: { limit: number; members: number };
}

const STATUS_BY_STRIPE_STATUS: Record<string, BillingStatusView['status']> = {
  active: 'ACTIVE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  past_due: 'PAST_DUE',
  trialing: 'TRIALING',
  unpaid: 'UNPAID',
};

const SYNCED_WEBHOOK_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.deleted',
  'customer.subscription.updated',
]);

@Injectable()
export class BillingService {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(StripeClient) private readonly stripe: StripeClient,
  ) {}

  async status(auth: AuthContext): Promise<BillingStatusView> {
    const membership = requireMembership(auth);
    const organizationId = membership.organization.id;
    const memberCount = await this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) =>
        transaction.membership.count({ where: { organizationId } }),
    );
    if (membership.organization.isDemo) {
      return {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        entitlements: entitlementsFor('PRO'),
        isDemoBilling: true,
        plan: 'PRO',
        status: 'ACTIVE',
        teamUsage: {
          limit: entitlementsFor('PRO').maxTeamMembers,
          members: memberCount,
        },
      };
    }
    const subscription = await this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) =>
        transaction.organizationSubscription.findUnique({
          where: { organizationId },
        }),
    );
    // Entitlements always follow the EFFECTIVE plan (status-aware), never
    // the stored plan: an incomplete checkout must not unlock Pro.
    const plan = effectivePlan(subscription);
    return {
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      entitlements: entitlementsFor(plan),
      isDemoBilling: false,
      plan,
      status: subscription?.status ?? null,
      teamUsage: {
        limit: entitlementsFor(plan).maxTeamMembers,
        members: memberCount,
      },
    };
  }

  async createCheckoutSession(auth: AuthContext, plan: Plan) {
    const membership = requireMembership(auth);
    if (membership.organization.isDemo) {
      throw new ConflictException({
        code: 'BILLING_DISABLED_FOR_DEMO',
        message:
          'Billing changes are disabled in the shared demo workspace. It always runs on the Demo Pro plan.',
      });
    }
    const priceId = this.priceIdFor(plan);
    if (!priceId) {
      throw new ServiceUnavailableException({
        code: 'BILLING_NOT_CONFIGURED',
        message: 'Billing is not configured for this deployment yet.',
      });
    }
    const organizationId = membership.organization.id;
    const customerId = await this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const existing = await transaction.organizationSubscription.findUnique({
          where: { organizationId },
        });
        if (existing?.stripeCustomerId) {
          await transaction.organizationSubscription.update({
            data: { plan, status: 'INCOMPLETE' },
            where: { organizationId },
          });
          return existing.stripeCustomerId;
        }
        const createdCustomer = await this.stripe.createCustomer({
          email: auth.user.email,
          name: membership.organization.name,
        });
        await transaction.organizationSubscription.upsert({
          create: {
            organizationId,
            plan,
            status: 'INCOMPLETE',
            stripeCustomerId: createdCustomer.id,
          },
          update: {
            plan,
            status: 'INCOMPLETE',
            stripeCustomerId: createdCustomer.id,
          },
          where: { organizationId },
        });
        return createdCustomer.id;
      },
    );
    const session = await this.stripe.createCheckoutSession({
      cancelUrl: `${this.environment.WEB_ORIGIN}/app/settings?section=billing`,
      customer: customerId,
      metadata: { organizationId },
      priceId,
      successUrl: `${this.environment.WEB_ORIGIN}/app/settings?section=billing`,
    });
    if (!session.url) {
      throw new ServiceUnavailableException({
        code: 'BILLING_NOT_CONFIGURED',
        message: 'Stripe could not prepare a checkout session.',
      });
    }
    return { url: session.url };
  }

  async createPortalSession(auth: AuthContext) {
    const membership = requireMembership(auth);
    if (membership.organization.isDemo) {
      throw new ConflictException({
        code: 'BILLING_DISABLED_FOR_DEMO',
        message: 'Billing changes are disabled in the shared demo workspace.',
      });
    }
    const organizationId = membership.organization.id;
    const subscription = await this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) =>
        transaction.organizationSubscription.findUnique({
          where: { organizationId },
        }),
    );
    if (!subscription?.stripeCustomerId) {
      throw new NotFoundException({
        code: 'BILLING_NO_SUBSCRIPTION',
        message: 'This workspace does not have a billing relationship yet.',
      });
    }
    const session = await this.stripe.createBillingPortalSession({
      customer: subscription.stripeCustomerId,
      returnUrl: `${this.environment.WEB_ORIGIN}/app/settings?section=billing`,
    });
    return { url: session.url };
  }

  /**
   * Stripe webhook entry: signature-verified, then dispatched to the
   * SECURITY DEFINER sync function which claims the event id and applies the
   * subscription/audit mutation in one transaction. Duplicate deliveries
   * (including Stripe retries) hit the claim and return without re-applying
   * business logic. Unknown prices/statuses are dropped without syncing.
   */
  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    if (!this.environment.STRIPE_WEBHOOK_SECRET) {
      throw new ServiceUnavailableException({
        code: 'BILLING_NOT_CONFIGURED',
        message: 'Billing is not configured for this deployment yet.',
      });
    }
    const valid = this.stripe.verifyWebhookSignature(
      rawBody,
      signatureHeader,
      this.environment.STRIPE_WEBHOOK_SECRET,
    );
    if (!valid) {
      throw new ConflictException({
        code: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'The webhook signature is invalid.',
      });
    }

    const event = JSON.parse(rawBody.toString('utf8')) as StripeWebhookEvent;
    if (!SYNCED_WEBHOOK_EVENTS.has(event.type)) return;

    const subscription = event.data.object;
    const status = STATUS_BY_STRIPE_STATUS[subscription.status];
    const plan = this.planForPrice(subscription);
    const organizationId = subscription.metadata?.organizationId;
    if (!status || !plan || !organizationId) return;

    await this.prisma.$executeRaw`
      SELECT stockpilot_sync_subscription(
        ${event.id}::varchar(160),
        ${event.type}::varchar(120),
        ${organizationId}::uuid,
        ${subscription.customer}::varchar(80),
        ${subscription.id}::varchar(80),
        ${priceIdOf(subscription)}::varchar(80),
        ${plan}::"Plan",
        ${status}::"SubscriptionStatus",
        ${new Date(subscription.current_period_end * 1000)}::timestamptz,
        ${subscription.cancel_at_period_end}
      )
    `;
  }

  private priceIdFor(plan: Plan): string | null {
    if (plan === 'STARTER')
      return this.environment.STRIPE_STARTER_PRICE_ID ?? null;
    return this.environment.STRIPE_PRO_PRICE_ID ?? null;
  }

  private planForPrice(
    subscription: StripeSubscriptionEventObject,
  ): Plan | null {
    const priceId = priceIdOf(subscription);
    if (priceId === this.environment.STRIPE_STARTER_PRICE_ID) return 'STARTER';
    if (priceId === this.environment.STRIPE_PRO_PRICE_ID) return 'PRO';
    return null;
  }
}

function priceIdOf(subscription: StripeSubscriptionEventObject): string {
  return subscription.items?.data?.[0]?.price?.id ?? '';
}
