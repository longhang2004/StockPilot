import { createHmac, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestAgent, demoLogin } from './support/agent.js';
import {
  adminDatabaseUrl,
  setTestEnvironment,
  TEST_WEB_ORIGIN,
} from './support/environment.js';
import {
  createAdminClient,
  createTestApplication,
} from './support/test-app.js';

describe('storefront integrations API', () => {
  const webhookSecret = 'integrations-webhook-secret';
  const demoSlug = `integrations-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: Awaited<ReturnType<typeof createTestAgent>>;
  let managerCsrf: string;
  let productSku: string;

  function sign(payload: unknown) {
    return createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  beforeAll(async () => {
    setTestEnvironment({
      CSRF_SECRET: 'integrations-csrf-secret-with-at-least-32-characters',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      WEBHOOK_SIGNING_SECRET: webhookSecret,
    });
    admin = await createAdminClient(adminDatabaseUrl());
    const { seedDemoIdentity } = await import('../prisma/seed.js');
    await seedDemoIdentity(admin, { seedFixture: false, slug: demoSlug });
    ({ app } = await createTestApplication());

    manager = createTestAgent(app);
    ({ csrfToken: managerCsrf } = await demoLogin(manager, 'MANAGER'));
    productSku = `WEB-${randomUUID().slice(0, 8)}`;
    await manager
      .post('/v1/products')
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
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
