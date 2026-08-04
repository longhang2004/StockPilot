import { createHmac, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('storefront integrations API', () => {
  const adminDatabaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const webhookSecret = 'integrations-webhook-secret';
  const demoSlug = `integrations-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: Agent;
  let managerCsrf: string;
  let productSku: string;

  async function createAdminClient() {
    const { createPrismaClient } =
      await import('../src/database/prisma-client.js');
    return createPrismaClient(adminDatabaseUrl);
  }

  function sign(payload: unknown) {
    return createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      CSRF_SECRET: 'integrations-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'true',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      NODE_ENV: 'test',
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: webhookSecret,
    });
    admin = await createAdminClient();
    const { seedDemoIdentity } = await import('../prisma/seed.js');
    await seedDemoIdentity(admin, { seedFixture: false, slug: demoSlug });
    const [{ AppModule }, { configureApplication }] = await Promise.all([
      import('../src/app.module.js'),
      import('../src/configure-application.js'),
    ]);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();

    manager = request.agent(app.getHttpServer());
    const login = await manager
      .post('/v1/auth/demo-login')
      .set('Origin', webOrigin)
      .send({ role: 'MANAGER' });
    managerCsrf = login.body.csrfToken as string;
    productSku = `WEB-${randomUUID().slice(0, 8)}`;
    await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Webhook Product',
        reorderPoint: 0,
        salePrice: '14.00',
        sku: productSku,
      });
  });

  afterAll(async () => {
    await app?.close();
    if (admin) {
      await admin.organization.deleteMany({ where: { slug: demoSlug } });
      await admin.user.deleteMany({
        where: { email: { endsWith: `@${demoSlug}.stockpilot.test` } },
      });
      await admin.$disconnect();
    }
  });

  it('verifies HMAC, deduplicates deliveries, and creates only a Draft order', async () => {
    const payload = {
      customer: {
        companyName: 'Storefront Market',
        email: 'orders@store.example',
      },
      eventType: 'order.created',
      externalOrderId: 'store-100',
      items: [{ quantity: 2, sku: productSku }],
    };
    const headers = {
      'X-Delivery-Id': 'delivery-100',
      'X-Organization-Slug': demoSlug,
      'X-Storefront-Signature': `sha256=${sign(payload)}`,
    };

    const first = await request(app.getHttpServer())
      .post('/v1/webhooks/mock-storefront/orders')
      .set(headers)
      .send(payload);
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({ duplicate: false, status: 'SUCCEEDED' });

    const duplicate = await request(app.getHttpServer())
      .post('/v1/webhooks/mock-storefront/orders')
      .set(headers)
      .send(payload);
    expect(duplicate.status).toBe(202);
    expect(duplicate.body).toMatchObject({
      duplicate: true,
      orderId: first.body.orderId,
      status: 'SUCCEEDED',
    });

    const orders = await manager.get('/v1/orders?search=store-100');
    expect(orders.body.total).toBe(1);
    expect(orders.body.items[0].status).toBe('DRAFT');
    const deliveries = await manager.get('/v1/integration-deliveries');
    expect(deliveries.body.total).toBe(1);
  });

  it('records failed deliveries and lets a Manager retry after fixing the catalog', async () => {
    const missingSku = `MISSING-${randomUUID().slice(0, 8)}`;
    const payload = {
      customer: { companyName: 'Retry Market' },
      eventType: 'order.created',
      externalOrderId: 'store-retry-1',
      items: [{ quantity: 1, sku: missingSku }],
    };
    const deliveryId = 'delivery-retry-1';
    const failed = await request(app.getHttpServer())
      .post('/v1/webhooks/mock-storefront/orders')
      .set('X-Delivery-Id', deliveryId)
      .set('X-Organization-Slug', demoSlug)
      .set('X-Storefront-Signature', sign(payload))
      .send(payload);
    expect(failed.status).toBe(202);
    expect(failed.body.status).toBe('FAILED');

    const product = await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Retry Product',
        reorderPoint: 0,
        salePrice: '9.00',
        sku: missingSku,
      });
    expect(product.status).toBe(201);
    const deliveries = await manager.get(
      '/v1/integration-deliveries?status=FAILED',
    );
    const delivery = deliveries.body.items.find(
      (item: { externalDeliveryId: string }) =>
        item.externalDeliveryId === deliveryId,
    );
    const retried = await manager
      .post(`/v1/integration-deliveries/${delivery.id}/retry`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', 'integration-retry-1')
      .send();
    expect(retried.status).toBe(200);
    expect(retried.body.status).toBe('SUCCEEDED');
  });

  it('rejects invalid webhook signatures', async () => {
    const payload = {
      customer: { companyName: 'Not Authorized' },
      eventType: 'order.created',
      externalOrderId: 'bad-signature',
      items: [{ quantity: 1, sku: productSku }],
    };
    const response = await request(app.getHttpServer())
      .post('/v1/webhooks/mock-storefront/orders')
      .set('X-Delivery-Id', 'delivery-bad-signature')
      .set('X-Organization-Slug', demoSlug)
      .set('X-Storefront-Signature', '00')
      .send(payload);
    expect(response.status).toBe(401);
  });
});
