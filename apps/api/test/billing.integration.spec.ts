import { createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { StripeClient } from '../src/billing/stripe-client.js';
import { createPrismaClient } from '../src/database/prisma-client.js';

const webhookSecret = 'whsec_integration_webhook_secret';

function signEvent(payload: Buffer, atSeconds = Date.now() / 1000): string {
  // The timestamp must be an integer and identical in both the HMAC input
  // and the t= header value, exactly like production Stripe signatures.
  const timestamp = Math.floor(atSeconds);
  const signature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload.toString('utf8')}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function subscriptionEvent(overrides: {
  customer?: string;
  eventId: string;
  eventType: string;
  organizationId: string;
  priceId?: string;
  status?: string;
  subscriptionId?: string;
}) {
  return Buffer.from(
    JSON.stringify({
      data: {
        object: {
          cancel_at_period_end: false,
          current_period_end: Math.floor(Date.now() / 1000) + 2_592_000,
          customer: overrides.customer ?? 'cus_owner_test',
          id: overrides.subscriptionId ?? 'sub_test_1',
          items: {
            data: [{ price: { id: overrides.priceId ?? 'price_pro' } }],
          },
          metadata: { organizationId: overrides.organizationId },
          status: overrides.status ?? 'active',
        },
      },
      id: overrides.eventId,
      type: overrides.eventType,
    }),
  );
}

describe('billing API', () => {
  const adminDatabaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const slug = `billing-test-${randomUUID()}`;
  const starterPriceId = 'price_starter_test';
  const proPriceId = 'price_pro_test';
  let app: INestApplication;

  /**
   * Delivers a signed webhook exactly like Stripe: JSON content type, raw
   * payload bytes. Nest only captures `request.rawBody` for JSON bodies, so
   * a plain octet-stream send would arrive with an empty raw body and fail
   * the signature check.
   */
  function deliverWebhook(payload: Buffer, header: string) {
    return request
      .agent(app.getHttpServer())
      .post('/v1/webhooks/stripe')
      .set('stripe-signature', header)
      .set('Content-Type', 'application/json')
      .send(payload.toString('utf8'));
  }
  let admin: Awaited<ReturnType<typeof createPrismaClient>>;
  let ownerAgent: ReturnType<typeof request.agent>;
  let ownerCsrf: string;
  let organizationId: string;
  const realStripe = new StripeClient('sk_test_integration');
  const fakeStripe: Partial<StripeClient> = {
    createBillingPortalSession: async () => ({
      url: 'https://billing.stripe.com/session/test',
    }),
    createCheckoutSession: async () => ({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    }),
    createCustomer: async () => ({ id: 'cus_owner_test' }),
    // Signature verification is pure (no network): delegate to the real
    // implementation so the webhook tests exercise production verification.
    verifyWebhookSignature: (payload, header, secret) =>
      realStripe.verifyWebhookSignature(payload, header, secret),
  };

  function api(
    agent: ReturnType<typeof request.agent>,
    method: 'delete' | 'get' | 'patch' | 'post',
    path: string,
  ) {
    const builder = agent[method](`/v1${path}`);
    if (method !== 'get') {
      builder.set('Origin', webOrigin);
      if (ownerCsrf) builder.set('X-CSRF-Token', ownerCsrf);
    }
    return builder;
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      CSRF_SECRET: 'integration-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'true',
      DEMO_ORGANIZATION_SLUG: slug,
      NODE_ENV: 'test',
      SESSION_COOKIE_NAME: 'stockpilot_session',
      SESSION_TTL_HOURS: '12',
      STRIPE_PRO_PRICE_ID: proPriceId,
      STRIPE_SECRET_KEY: 'sk_test_integration',
      STRIPE_STARTER_PRICE_ID: starterPriceId,
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: 'integration-webhook-secret',
    });

    admin = await createPrismaClient(adminDatabaseUrl);
    // Seed the canonical demo org so demo-login works in this suite.
    const { hash } = await import('argon2');
    const passwordHash = await hash('DemoPass123!');
    const demoOrg = await admin.organization.create({
      data: {
        isDemo: true,
        name: 'Billing Demo Wholesale',
        slug,
      },
    });

    for (const role of ['OWNER', 'MANAGER', 'STAFF'] as const) {
      const user = await admin.user.create({
        data: {
          displayName: `Demo ${role}`,
          // Distinct prefix: the suite later signs up a real user with the
          // `${slug}-owner@stockpilot.test` email.
          email: `${slug}-demo-${role.toLowerCase()}@stockpilot.test`,
          passwordHash,
        },
      });
      await admin.membership.create({
        data: { organizationId: demoOrg.id, role, userId: user.id },
      });
    }

    const [{ AppModule }, { configureApplication }] = await Promise.all([
      import('../src/app.module.js'),
      import('../src/configure-application.js'),
    ]);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeClient)
      .useValue(fakeStripe)
      .compile();
    // Mirrors main.ts: rawBody preserves the untouched payload for Stripe
    // webhook signature verification.
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApplication(app);
    await app.init();

    // Real (non-demo) workspace with an Owner.
    ownerAgent = request.agent(app.getHttpServer());
    const signup = await api(ownerAgent, 'post', '/auth/signup')
      .send({
        displayName: 'Billing Owner',
        email: `${slug}-owner@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201);
    ownerCsrf = signup.body.csrfToken;
    const workspace = await api(ownerAgent, 'post', '/organizations')
      .send({ name: `${slug}-workspace` })
      .expect(201);
    ownerCsrf = workspace.body.csrfToken;
    organizationId = workspace.body.membership.organization.id;
  });

  afterAll(async () => {
    await app?.close();
    if (admin) {
      await admin.billingWebhookEvent.deleteMany({});
      await admin.organization.deleteMany({
        where: { slug: { startsWith: slug } },
      });
      await admin.user.deleteMany({
        // Scoped to this suite: parallel suites share the database and a
        // global email filter would delete their users mid-run.
        where: { email: { startsWith: `${slug}-` } },
      });
    }
  });

  it('shows the demo workspace on a synthetic Demo Pro plan', async () => {
    const demo = await request
      .agent(app.getHttpServer())
      .post('/v1/auth/demo-login')
      .set('Origin', webOrigin)
      .send({ role: 'OWNER' })
      .expect(200);
    const status = await request
      .agent(app.getHttpServer())
      .get('/v1/billing')
      .set('Cookie', demo.headers['set-cookie'])
      .expect(200);
    expect(status.body.plan).toBe('PRO');
    expect(status.body.isDemoBilling).toBe(true);
    expect(status.body.entitlements.csvImport).toBe(true);
  });

  it('blocks billing changes for the shared demo workspace', async () => {
    const demo = await request
      .agent(app.getHttpServer())
      .post('/v1/auth/demo-login')
      .set('Origin', webOrigin)
      .send({ role: 'OWNER' })
      .expect(200);
    const csrf = demo.body.csrfToken;
    const checkout = await request
      .agent(app.getHttpServer())
      .post('/v1/billing/checkout')
      .set('Cookie', demo.headers['set-cookie'])
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', csrf)
      .send({ plan: 'PRO' })
      .expect(409);
    expect(checkout.body.code).toBe('BILLING_DISABLED_FOR_DEMO');
    const portal = await request
      .agent(app.getHttpServer())
      .post('/v1/billing/portal')
      .set('Cookie', demo.headers['set-cookie'])
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', csrf)
      .expect(409);
    expect(portal.body.code).toBe('BILLING_DISABLED_FOR_DEMO');
  });

  it('starts a checkout from the authenticated tenant context', async () => {
    const checkout = await api(ownerAgent, 'post', '/billing/checkout')
      .send({ plan: 'STARTER' })
      .expect(200);
    expect(checkout.body.url).toContain('checkout.stripe.com');
    const subscription = await admin.organizationSubscription.findUnique({
      where: { organizationId },
    });
    expect(subscription?.stripeCustomerId).toMatch(/^cus_/);
    expect(subscription?.plan).toBe('STARTER');
    expect(subscription?.status).toBe('INCOMPLETE');
  });

  it('rejects invalid webhook signatures', async () => {
    const payload = subscriptionEvent({
      eventId: `evt_bad_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
    });
    await deliverWebhook(payload, 't=1,v1=forged').expect(409);
  });

  it('syncs a valid subscription event once, even when retried', async () => {
    const eventId = `evt_sync_${randomUUID()}`;
    const payload = subscriptionEvent({
      eventId,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: proPriceId,
      subscriptionId: 'sub_sync_test',
    });
    const header = signEvent(payload);
    const auditCountBefore = await admin.auditEvent.count({
      where: { action: 'BILLING_SUBSCRIPTION_UPDATED' },
    });

    const delivery = await deliverWebhook(payload, header).expect(200);
    expect(delivery.body).toEqual({});

    const synced = await admin.organizationSubscription.findUnique({
      where: { organizationId },
    });
    expect(synced?.stripeSubscriptionId).toBe('sub_sync_test');
    expect(synced?.plan).toBe('PRO');
    expect(synced?.status).toBe('ACTIVE');
    const updatedAtAfterFirst = synced?.updatedAt;

    // Exactly one audit row for the mutation (no duplicate side effects).
    const auditAfterFirst = await admin.auditEvent.count({
      where: { action: 'BILLING_SUBSCRIPTION_UPDATED' },
    });
    expect(auditAfterFirst).toBe(auditCountBefore + 1);
    const audit = await admin.auditEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { action: 'BILLING_SUBSCRIPTION_UPDATED' },
    });
    expect(audit?.entityType).toBe('OrganizationSubscription');

    // Retry delivery: the event id is claimed before any mutation, so the
    // business effect (subscription row + audit row) must NOT repeat.
    await deliverWebhook(payload, header).expect(200);
    const events = await admin.billingWebhookEvent.count({
      where: { stripeEventId: eventId },
    });
    expect(events).toBe(1);
    const auditAfterRetry = await admin.auditEvent.count({
      where: { action: 'BILLING_SUBSCRIPTION_UPDATED' },
    });
    expect(auditAfterRetry).toBe(auditCountBefore + 1);
    const afterRetry = await admin.organizationSubscription.findUnique({
      where: { organizationId },
    });
    expect(afterRetry?.updatedAt).toEqual(updatedAtAfterFirst);
    expect(afterRetry?.stripeSubscriptionId).toBe('sub_sync_test');
  });

  it('applies only to the workspace named in the event metadata', async () => {
    const otherOrg = await admin.organization.create({
      data: {
        isDemo: false,
        name: 'Unaffected Wholesale',
        slug: `${slug}-other`,
      },
    });
    // A stored Stripe customer relationship is required before any event can
    // apply: this mirrors what checkout creates.
    await admin.organizationSubscription.create({
      data: {
        organizationId: otherOrg.id,
        plan: 'STARTER',
        status: 'INCOMPLETE',
        stripeCustomerId: 'cus_other_test',
      },
    });
    const payload = subscriptionEvent({
      customer: 'cus_other_test',
      eventId: `evt_other_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId: otherOrg.id,
      priceId: starterPriceId,
      subscriptionId: 'sub_other_test',
    });
    await deliverWebhook(payload, signEvent(payload)).expect(200);
    const unaffected = await admin.organizationSubscription.findUnique({
      where: { organizationId: otherOrg.id },
    });
    expect(unaffected?.stripeSubscriptionId).toBe('sub_other_test');
    // The main org's subscription is untouched.
    const main = await admin.organizationSubscription.findUnique({
      where: { organizationId },
    });
    expect(main?.stripeSubscriptionId).toBe('sub_sync_test');
  });

  it('never trusts the metadata organization id without a customer match', async () => {
    const otherOrg = await admin.organization.create({
      data: {
        isDemo: false,
        name: 'Mismatched Wholesale',
        slug: `${slug}-mismatch`,
      },
    });
    await admin.organizationSubscription.create({
      data: {
        organizationId: otherOrg.id,
        plan: 'STARTER',
        status: 'INCOMPLETE',
        stripeCustomerId: 'cus_other_test',
      },
    });
    // Event claims another customer's subscription for this workspace:
    // signature is valid, but the customer relationship does not match, so
    // the mutation must be ignored.
    const payload = subscriptionEvent({
      customer: 'cus_owner_test',
      eventId: `evt_mismatch_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId: otherOrg.id,
      priceId: proPriceId,
      subscriptionId: 'sub_mismatch',
    });
    await deliverWebhook(payload, signEvent(payload)).expect(200);
    const untouched = await admin.organizationSubscription.findUnique({
      where: { organizationId: otherOrg.id },
    });
    expect(untouched?.stripeSubscriptionId).toBeNull();
    expect(untouched?.plan).toBe('STARTER');
    expect(untouched?.status).toBe('INCOMPLETE');
    const audit = await admin.auditEvent.count({
      where: {
        action: 'BILLING_SUBSCRIPTION_UPDATED',
        organizationId: otherOrg.id,
      },
    });
    expect(audit).toBe(0);
  });

  it('enforces the Starter team limit server-side', async () => {
    // Downgrade to Starter, then try to exceed the three-member limit.
    const downgrade = subscriptionEvent({
      eventId: `evt_down_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: starterPriceId,
      subscriptionId: 'sub_starter_test',
    });
    await deliverWebhook(downgrade, signEvent(downgrade)).expect(200);

    await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-m1@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
    await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-m2@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
    const overLimit = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-m3@stockpilot.test`, role: 'MANAGER' })
      .expect(409);
    expect(overLimit.body.code).toBe('PLAN_LIMIT_REACHED');
  });

  it('lets Pro exceed the Starter limit', async () => {
    const upgrade = subscriptionEvent({
      eventId: `evt_up_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: proPriceId,
      subscriptionId: 'sub_pro_again',
    });
    await deliverWebhook(upgrade, signEvent(upgrade)).expect(200);

    await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-m3@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
    await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-m4@stockpilot.test`, role: 'MANAGER' })
      .expect(201);
  });

  it('gates CSV import behind the Pro entitlement', async () => {
    const downgrade = subscriptionEvent({
      eventId: `evt_csv_down_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: starterPriceId,
      subscriptionId: 'sub_csv_starter',
    });
    await deliverWebhook(downgrade, signEvent(downgrade)).expect(200);

    const blocked = await api(ownerAgent, 'post', '/product-imports/preview')
      .send({
        content:
          'sku,name,sale_price,reorder_point\nNEW-1,New Product,9.99,5\n',
        fileName: 'products.csv',
      })
      .expect(403);
    expect(blocked.body.code).toBe('PLAN_FEATURE_UNAVAILABLE');

    const upgrade = subscriptionEvent({
      eventId: `evt_csv_up_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: proPriceId,
      subscriptionId: 'sub_csv_pro',
    });
    await deliverWebhook(upgrade, signEvent(upgrade)).expect(200);
    const allowed = await api(ownerAgent, 'post', '/product-imports/preview')
      .send({
        content:
          'sku,name,sale_price,reorder_point\nNEW-1,New Product,9.99,5\n',
        fileName: 'products.csv',
      })
      .expect(201);
    expect(allowed.body.rowsValid).toBe(1);
    expect(allowed.body.rowsInvalid).toBe(0);
    expect(allowed.body.errors).toEqual([]);
  });

  it('does not grant Pro entitlements from a checkout alone', async () => {
    // A second real workspace whose owner starts a Pro checkout but never
    // completes payment: the stored plan must not become the effective plan.
    const proAgent = request.agent(app.getHttpServer());
    const ownerCsrfSnapshot = ownerCsrf;
    const signup = await api(proAgent, 'post', '/auth/signup')
      .send({
        displayName: 'Pro Hopeful',
        email: `${slug}-pro-hope@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201);
    ownerCsrf = signup.body.csrfToken;
    const workspace = await api(proAgent, 'post', '/organizations')
      .send({ name: `${slug}-pro-hope` })
      .expect(201);
    // The workspace response rotates the session CSRF token.
    ownerCsrf = workspace.body.csrfToken;
    const proOrgId = workspace.body.membership.organization.id;

    await api(proAgent, 'post', '/billing/checkout')
      .send({ plan: 'PRO' })
      .expect(200);
    const stored = await admin.organizationSubscription.findUnique({
      where: { organizationId: proOrgId },
    });
    expect(stored?.plan).toBe('PRO');
    expect(stored?.status).toBe('INCOMPLETE');

    // The stored row says PRO, but entitlements must still be Starter.
    const status = await api(proAgent, 'get', '/billing').expect(200);
    expect(status.body.plan).toBe('STARTER');
    expect(status.body.status).toBe('INCOMPLETE');
    expect(status.body.entitlements.csvImport).toBe(false);
    const blocked = await api(proAgent, 'post', '/product-imports/preview')
      .send({
        content:
          'sku,name,sale_price,reorder_point\nNEW-1,New Product,9.99,5\n',
        fileName: 'products.csv',
      })
      .expect(403);
    expect(blocked.body.code).toBe('PLAN_FEATURE_UNAVAILABLE');
    ownerCsrf = ownerCsrfSnapshot;

    // Even a valid active webhook with an UNKNOWN price must not unlock Pro.
    const unknownPrice = subscriptionEvent({
      customer: 'cus_owner_test',
      eventId: `evt_unknown_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId: proOrgId,
      priceId: 'price_unknown_mystery',
      subscriptionId: 'sub_unknown',
    });
    await deliverWebhook(unknownPrice, signEvent(unknownPrice)).expect(200);
    const stillStarter = await api(proAgent, 'get', '/billing').expect(200);
    expect(stillStarter.body.plan).toBe('STARTER');
    expect(stillStarter.body.status).toBe('INCOMPLETE');

    // Only an eligible Stripe-confirmed subscription flips the entitlement.
    const confirmed = subscriptionEvent({
      customer: 'cus_owner_test',
      eventId: `evt_confirmed_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId: proOrgId,
      priceId: proPriceId,
      subscriptionId: 'sub_pro_confirmed',
    });
    await deliverWebhook(confirmed, signEvent(confirmed)).expect(200);
    const nowPro = await api(proAgent, 'get', '/billing').expect(200);
    expect(nowPro.body.plan).toBe('PRO');
    expect(nowPro.body.status).toBe('ACTIVE');
    expect(nowPro.body.entitlements.csvImport).toBe(true);
  });

  it('does not retain Pro after a subscription is canceled', async () => {
    const canceled = subscriptionEvent({
      customer: 'cus_owner_test',
      eventId: `evt_cancel_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: proPriceId,
      status: 'canceled',
      subscriptionId: 'sub_canceled_test',
    });
    await deliverWebhook(canceled, signEvent(canceled)).expect(200);
    const status = await api(ownerAgent, 'get', '/billing').expect(200);
    expect(status.body.status).toBe('CANCELED');
    expect(status.body.plan).toBe('STARTER');
    expect(status.body.entitlements.csvImport).toBe(false);
    const blocked = await api(ownerAgent, 'post', '/product-imports/preview')
      .send({
        content:
          'sku,name,sale_price,reorder_point\nNEW-1,New Product,9.99,5\n',
        fileName: 'products.csv',
      })
      .expect(403);
    expect(blocked.body.code).toBe('PLAN_FEATURE_UNAVAILABLE');
  });

  it('re-checks the seat limit when accepting after a downgrade', async () => {
    // Return the workspace to Pro, fill it with members, issue a pending
    // invitation, then downgrade to Starter: the pending invitation must not
    // be able to exceed the Starter seat limit through acceptance.
    const upgrade = subscriptionEvent({
      customer: 'cus_owner_test',
      eventId: `evt_recheck_up_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: proPriceId,
      subscriptionId: 'sub_recheck_pro',
    });
    await deliverWebhook(upgrade, signEvent(upgrade)).expect(200);

    const { hash } = await import('argon2');
    const passwordHash = await hash('DemoPass123!');
    for (const name of ['seat-1', 'seat-2', 'seat-3']) {
      const user = await admin.user.create({
        data: {
          displayName: `Seat ${name}`,
          email: `${slug}-${name}@stockpilot.test`,
          passwordHash,
        },
      });
      await admin.membership.create({
        data: { organizationId, role: 'STAFF', userId: user.id },
      });
    }
    expect(await admin.membership.count({ where: { organizationId } })).toBe(4);

    // The pending invitation is issued while Pro (limit 20) ...
    const invite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-seat-pending@stockpilot.test`, role: 'STAFF' })
      .expect(201);

    // ... then the workspace drops to Starter (limit 3) before acceptance.
    const downgrade = subscriptionEvent({
      customer: 'cus_owner_test',
      eventId: `evt_recheck_down_${randomUUID()}`,
      eventType: 'customer.subscription.updated',
      organizationId,
      priceId: starterPriceId,
      subscriptionId: 'sub_recheck_starter',
    });
    await deliverWebhook(downgrade, signEvent(downgrade)).expect(200);

    const ownerCsrfSnapshot = ownerCsrf;
    const pendingAgent = request.agent(app.getHttpServer());
    const signup = await api(pendingAgent, 'post', '/auth/signup')
      .send({
        displayName: 'Seat Pending',
        email: `${slug}-seat-pending@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201);
    ownerCsrf = signup.body.csrfToken;
    const rejected = await api(pendingAgent, 'post', '/team/invitations/accept')
      .send({ token: invite.body.rawToken })
      .expect(409);
    expect(rejected.body.code).toBe('PLAN_LIMIT_REACHED');
    ownerCsrf = ownerCsrfSnapshot;

    // New invitations are also blocked while the membership count is at or
    // above the Starter limit.
    const anotherInvite = await api(ownerAgent, 'post', '/team/invitations')
      .send({ email: `${slug}-seat-extra@stockpilot.test`, role: 'STAFF' })
      .expect(409);
    expect(anotherInvite.body.code).toBe('PLAN_LIMIT_REACHED');
  });

  it('gates the integrations workspace behind the Pro entitlement', async () => {
    // The workspace is on Starter at this point: the deliveries list and the
    // retry action are Pro entitlements and must be rejected server-side.
    const blockedList = await api(
      ownerAgent,
      'get',
      '/integration-deliveries',
    ).expect(403);
    expect(blockedList.body.code).toBe('PLAN_FEATURE_UNAVAILABLE');
    const blockedRetry = await api(
      ownerAgent,
      'post',
      '/integration-deliveries/00000000-0000-0000-0000-000000000000/retry',
    )
      .set('Idempotency-Key', 'integration-retry-entitlement-test')
      .expect(403);
    expect(blockedRetry.body.code).toBe('PLAN_FEATURE_UNAVAILABLE');
  });
});
