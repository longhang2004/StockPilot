import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestAgent, demoLogin } from './support/agent.js';
import {
  adminDatabaseUrl,
  appDatabaseUrl,
  setTestEnvironment,
  TEST_WEB_ORIGIN,
} from './support/environment.js';
import {
  createAdminClient,
  createTestApplication,
} from './support/test-app.js';

describe('sales orders API', () => {
  const demoSlug = `orders-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: Awaited<ReturnType<typeof createTestAgent>>;
  let managerCsrf: string;
  let staff: Awaited<ReturnType<typeof createTestAgent>>;
  let staffCsrf: string;
  let productId: string;
  let customerId: string;
  let supplierId: string;
  const applicationName = `orders-${randomUUID()}`;

  async function createOrder(
    agent: Awaited<ReturnType<typeof createTestAgent>>,
    csrfToken: string,
    quantity: number,
  ) {
    return agent
      .post('/v1/orders')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', csrfToken)
      .send({ customerId, lines: [{ productId, quantity }] });
  }

  beforeAll(async () => {
    setTestEnvironment({
      CSRF_SECRET: 'orders-csrf-secret-with-at-least-32-characters',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      WEBHOOK_SIGNING_SECRET: 'orders-webhook-secret',
      DATABASE_URL: `${appDatabaseUrl()}${appDatabaseUrl().includes('?') ? '&' : '?'}application_name=${applicationName}`,
    });

    admin = await createAdminClient(adminDatabaseUrl());
    const { seedDemoIdentity } = await import('../prisma/seed.js');
    await seedDemoIdentity(admin, { seedFixture: false, slug: demoSlug });

    ({ app } = await createTestApplication());

    const managerAgent = createTestAgent(app);
    ({ csrfToken: managerCsrf } = await demoLogin(managerAgent, 'MANAGER'));
    manager = managerAgent;
    const staffAgent = createTestAgent(app);
    ({ csrfToken: staffCsrf } = await demoLogin(staffAgent, 'STAFF'));
    staff = staffAgent;

    const product = await manager
      .post('/v1/products')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Order Test Product',
        reorderPoint: 1,
        salePrice: '25.00',
        sku: `ORDER-${randomUUID().slice(0, 8)}`,
      });
    const customer = await manager
      .post('/v1/customers')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Order Test Market', contactName: 'Casey Lee' });
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Order Test Supplier' });
    productId = product.body.id as string;
    customerId = customer.body.id as string;
    supplierId = supplier.body.id as string;
    await manager
      .post('/v1/receipts')
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', staffCsrf)
      .set('Idempotency-Key', `confirm-${randomUUID()}`)
      .send();
    expect(staffConfirm.status).toBe(403);

    const confirmKey = `confirm-${randomUUID()}`;
    const confirmed = await manager
      .post(`/v1/orders/${draft.body.id}/confirm`)
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', confirmKey)
      .send();
    const replayed = await manager
      .post(`/v1/orders/${draft.body.id}/confirm`)
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `confirm-${randomUUID()}`)
      .send();
    expect(confirmed.status).toBe(200);

    const cancelled = await manager
      .post(`/v1/orders/${draft.body.id}/cancel`)
      .set('Origin', TEST_WEB_ORIGIN)
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
        .set('Origin', TEST_WEB_ORIGIN)
        .set('X-CSRF-Token', managerCsrf)
        .set('Idempotency-Key', `confirm-${randomUUID()}`)
        .send(),
      manager
        .post(`/v1/orders/${second.body.id}/confirm`)
        .set('Origin', TEST_WEB_ORIGIN)
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

  it.each(['confirm-first', 'edit-first'] as const)(
    'serializes Draft edits against confirmation (%s)',
    async (sequence) => {
      const product = await manager
        .post('/v1/products')
        .set('Origin', TEST_WEB_ORIGIN)
        .set('X-CSRF-Token', managerCsrf)
        .send({
          name: 'Concurrent Order Product',
          reorderPoint: 0,
          salePrice: '10.00',
          sku: `RACE-${randomUUID()}`,
        });
      expect(product.status).toBe(201);
      const raceProductId = product.body.id as string;
      const receipt = await manager
        .post('/v1/receipts')
        .set('Origin', TEST_WEB_ORIGIN)
        .set('X-CSRF-Token', managerCsrf)
        .set('Idempotency-Key', randomUUID())
        .send({
          lines: [{ productId: raceProductId, quantity: 6, unitCost: '5.00' }],
          receiptNumber: `RACE-${randomUUID()}`,
          receivedAt: new Date().toISOString(),
          supplierId,
        });
      expect(receipt.status).toBe(201);
      const draft = await manager
        .post('/v1/orders')
        .set('Origin', TEST_WEB_ORIGIN)
        .set('X-CSRF-Token', managerCsrf)
        .send({
          customerId,
          lines: [{ productId: raceProductId, quantity: 1 }],
        });
      expect(draft.status).toBe(201);
      const orderId = draft.body.id as string;

      const waitForBlockedRequests = (count: number) =>
        expect
          .poll(
            async () => {
              const rows = await admin.$queryRaw<Array<{ count: number }>>`
            SELECT count(*)::int AS count
            FROM pg_stat_activity
            WHERE application_name = ${applicationName}
              AND wait_event_type = 'Lock'
          `;
              return rows[0]!.count;
            },
            { interval: 20, timeout: 3000 },
          )
          .toBe(count);

      // Hold the parent row so the two real HTTP requests queue in a known
      // order. Waiting for database lock state avoids timing-based sleeps.
      const requests = await admin.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT id FROM sales_orders WHERE id = ${orderId}::uuid FOR UPDATE
        `;
        const confirm = () =>
          manager
            .post(`/v1/orders/${orderId}/confirm`)
            .set('Origin', TEST_WEB_ORIGIN)
            .set('X-CSRF-Token', managerCsrf)
            .set('Idempotency-Key', randomUUID())
            .send()
            .then((response) => response);
        const edit = () =>
          manager
            .patch(`/v1/orders/${orderId}`)
            .set('Origin', TEST_WEB_ORIGIN)
            .set('X-CSRF-Token', managerCsrf)
            .send({
              customerId,
              lines: [{ productId: raceProductId, quantity: 3 }],
            })
            .then((response) => response);
        const first = sequence === 'confirm-first' ? confirm() : edit();
        await waitForBlockedRequests(1);
        const second = sequence === 'confirm-first' ? edit() : confirm();
        await waitForBlockedRequests(2);
        return { first, second };
      });
      const [first, second] = await Promise.all([
        requests.first,
        requests.second,
      ]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(sequence === 'confirm-first' ? 409 : 200);
      const detail = await manager.get(`/v1/orders/${orderId}`);
      const quantity = sequence === 'confirm-first' ? 1 : 3;
      expect(detail.body).toMatchObject({
        status: 'CONFIRMED',
        lines: [{ quantity }],
        subtotal: `${quantity * 10}.00`,
      });
      const balance = await admin.inventoryBalance.findFirstOrThrow({
        where: { productId: raceProductId },
      });
      expect(balance.reserved).toBe(quantity);
    },
  );
});
