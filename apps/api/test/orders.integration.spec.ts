import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('sales orders API', () => {
  const adminDatabaseUrl =
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const demoSlug = `orders-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: Agent;
  let managerCsrf: string;
  let staff: Agent;
  let staffCsrf: string;
  let productId: string;
  let customerId: string;

  async function createAdminClient() {
    const { createPrismaClient } =
      await import('../src/database/prisma-client.js');
    return createPrismaClient(adminDatabaseUrl);
  }

  async function loginAs(role: 'MANAGER' | 'STAFF') {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/v1/auth/demo-login')
      .set('Origin', webOrigin)
      .send({ role });
    return { agent, csrfToken: response.body.csrfToken as string };
  }

  async function createOrder(
    agent: Agent,
    csrfToken: string,
    quantity: number,
  ) {
    return agent
      .post('/v1/orders')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', csrfToken)
      .send({ customerId, lines: [{ productId, quantity }] });
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      CSRF_SECRET: 'orders-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'true',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      NODE_ENV: 'test',
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: 'orders-webhook-secret',
    });

    admin = await createAdminClient();
    const { seedDemoIdentity } = await import('../prisma/seed.js');
    await seedDemoIdentity(admin, { slug: demoSlug });

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

    ({ agent: manager, csrfToken: managerCsrf } = await loginAs('MANAGER'));
    ({ agent: staff, csrfToken: staffCsrf } = await loginAs('STAFF'));

    const product = await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Order Test Product',
        reorderPoint: 1,
        salePrice: '25.00',
        sku: `ORDER-${randomUUID().slice(0, 8)}`,
      });
    const customer = await manager
      .post('/v1/customers')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Order Test Market', contactName: 'Casey Lee' });
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Order Test Supplier' });
    productId = product.body.id as string;
    customerId = customer.body.id as string;
    await manager
      .post('/v1/receipts')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `receipt-${randomUUID()}`)
      .send({
        lines: [{ productId, quantity: 6, unitCost: '12.00' }],
        receiptNumber: `ORDER-GR-${randomUUID()}`,
        receivedAt: '2026-08-04T03:30:00.000Z',
        supplierId: supplier.body.id,
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

  it('snapshots prices, separates confirm from fulfill, and records transitions', async () => {
    const draft = await createOrder(staff, staffCsrf, 4);
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({
      status: 'DRAFT',
      lines: [
        {
          productId,
          productNameSnapshot: 'Order Test Product',
          quantity: 4,
          skuSnapshot: expect.any(String),
          unitPrice: '25.00',
        },
      ],
      subtotal: '100.00',
    });

    const staffConfirm = await staff
      .post(`/v1/orders/${draft.body.id}/confirm`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', staffCsrf)
      .set('Idempotency-Key', `confirm-${randomUUID()}`)
      .send();
    expect(staffConfirm.status).toBe(403);

    const confirmKey = `confirm-${randomUUID()}`;
    const confirmed = await manager
      .post(`/v1/orders/${draft.body.id}/confirm`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', confirmKey)
      .send();
    const replayed = await manager
      .post(`/v1/orders/${draft.body.id}/confirm`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', confirmKey)
      .send();
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('CONFIRMED');
    expect(replayed.body.id).toBe(confirmed.body.id);

    const balancesAfterConfirm = await manager.get('/v1/inventory/balances');
    expect(balancesAfterConfirm.body.items[0]).toMatchObject({
      available: 2,
      onHand: 6,
      reserved: 4,
    });

    const fulfilled = await staff
      .post(`/v1/orders/${draft.body.id}/fulfill`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', staffCsrf)
      .set('Idempotency-Key', `fulfill-${randomUUID()}`)
      .send();
    expect(fulfilled.status).toBe(200);
    expect(fulfilled.body.status).toBe('FULFILLED');

    const detail = await staff.get(`/v1/orders/${draft.body.id}`);
    expect(detail.status).toBe(200);
    expect(
      detail.body.transitions.map(
        (transition: { toStatus: string }) => transition.toStatus,
      ),
    ).toEqual(['DRAFT', 'CONFIRMED', 'FULFILLED']);
    const movements = await staff.get('/v1/inventory/movements');
    expect(
      movements.body.items.some(
        (movement: { type: string }) => movement.type === 'SALE',
      ),
    ).toBe(true);
  });

  it('releases confirmed reservations on cancellation', async () => {
    const draft = await createOrder(staff, staffCsrf, 1);
    const confirmed = await manager
      .post(`/v1/orders/${draft.body.id}/confirm`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `confirm-${randomUUID()}`)
      .send();
    expect(confirmed.status).toBe(200);

    const cancelled = await manager
      .post(`/v1/orders/${draft.body.id}/cancel`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `cancel-${randomUUID()}`)
      .send();
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    const balances = await manager.get('/v1/inventory/balances');
    expect(balances.body.items[0].reserved).toBe(0);
  });

  it('serializes concurrent confirmations and never reserves more than available', async () => {
    const first = await createOrder(staff, staffCsrf, 2);
    const second = await createOrder(staff, staffCsrf, 2);
    const [firstResult, secondResult] = await Promise.all([
      manager
        .post(`/v1/orders/${first.body.id}/confirm`)
        .set('Origin', webOrigin)
        .set('X-CSRF-Token', managerCsrf)
        .set('Idempotency-Key', `confirm-${randomUUID()}`)
        .send(),
      manager
        .post(`/v1/orders/${second.body.id}/confirm`)
        .set('Origin', webOrigin)
        .set('X-CSRF-Token', managerCsrf)
        .set('Idempotency-Key', `confirm-${randomUUID()}`)
        .send(),
    ]);
    expect([firstResult.status, secondResult.status].sort()).toEqual([
      200, 409,
    ]);
    const balances = await manager.get('/v1/inventory/balances');
    expect(balances.body.items[0].reserved).toBe(2);
  });
});
