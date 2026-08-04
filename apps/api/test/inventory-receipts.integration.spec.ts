import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('inventory receipts and adjustments API', () => {
  const adminDatabaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const demoSlug = `inventory-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: Agent;
  let managerCsrf: string;
  let staff: Agent;
  let staffCsrf: string;

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

  beforeAll(async () => {
    Object.assign(process.env, {
      CSRF_SECRET: 'inventory-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'true',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      NODE_ENV: 'test',
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: 'inventory-webhook-secret',
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

  it('applies receipts atomically, replays idempotent responses, and reconciles low stock', async () => {
    const product = await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Shelf Stable Oat Milk',
        reorderPoint: 5,
        salePrice: '42.50',
        sku: `OAT-${randomUUID().slice(0, 8)}`,
      });
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Greenway Foods' });
    expect(product.status).toBe(201);
    expect(supplier.status).toBe(201);

    const receiptPayload = {
      lines: [{ productId: product.body.id, quantity: 12, unitCost: '18.50' }],
      receiptNumber: `GR-${randomUUID()}`,
      receivedAt: '2026-08-04T03:30:00.000Z',
      supplierId: supplier.body.id,
    };
    const idempotencyKey = `receipt-${randomUUID()}`;
    const receipt = await manager
      .post('/v1/receipts')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', idempotencyKey)
      .send(receiptPayload);
    const replay = await manager
      .post('/v1/receipts')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', idempotencyKey)
      .send(receiptPayload);

    expect(receipt.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(receipt.body.id);
    expect(receipt.body.lines[0]).toMatchObject({
      productId: product.body.id,
      quantity: 12,
      unitCost: '18.50',
    });

    const conflictingRetry = await manager
      .post('/v1/receipts')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        ...receiptPayload,
        lines: [{ productId: product.body.id, quantity: 11 }],
      });
    expect(conflictingRetry.status).toBe(409);

    let balances = await manager.get('/v1/inventory/balances');
    let movements = await manager.get('/v1/inventory/movements');
    expect(balances.body.items[0]).toMatchObject({
      available: 12,
      onHand: 12,
      productId: product.body.id,
      reserved: 0,
    });
    expect(movements.body.items).toHaveLength(1);

    const rejectedAdjustment = await manager
      .post('/v1/inventory/adjustments')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `adjustment-${randomUUID()}`)
      .send({
        productId: product.body.id,
        quantity: 13,
        reason: 'Damaged during cycle count',
        type: 'ADJUSTMENT_OUT',
      });
    expect(rejectedAdjustment.status).toBe(409);

    balances = await manager.get('/v1/inventory/balances');
    movements = await manager.get('/v1/inventory/movements');
    expect(balances.body.items[0].onHand).toBe(12);
    expect(movements.body.items).toHaveLength(1);

    const adjustmentOut = await manager
      .post('/v1/inventory/adjustments')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `adjustment-${randomUUID()}`)
      .send({
        productId: product.body.id,
        quantity: 7,
        reason: 'Damaged during cycle count',
        type: 'ADJUSTMENT_OUT',
      });
    expect(adjustmentOut.status).toBe(201);
    expect(adjustmentOut.body.balance.available).toBe(5);

    let alerts = await manager.get('/v1/alerts?status=OPEN');
    expect(alerts.body.items).toHaveLength(1);
    expect(alerts.body.items[0].productId).toBe(product.body.id);

    const adjustmentIn = await manager
      .post('/v1/inventory/adjustments')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `adjustment-${randomUUID()}`)
      .send({
        productId: product.body.id,
        quantity: 3,
        reason: 'Recovered from quarantine',
        type: 'ADJUSTMENT_IN',
      });
    expect(adjustmentIn.status).toBe(201);
    expect(adjustmentIn.body.balance.available).toBe(8);

    alerts = await manager.get('/v1/alerts?status=OPEN');
    const resolvedAlerts = await manager.get('/v1/alerts?status=RESOLVED');
    expect(alerts.body.items).toHaveLength(0);
    expect(resolvedAlerts.body.items).toHaveLength(1);
  });

  it('keeps receiving and adjustment permissions away from Staff', async () => {
    const response = await staff
      .post('/v1/inventory/adjustments')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', staffCsrf)
      .set('Idempotency-Key', `adjustment-${randomUUID()}`)
      .send({
        productId: randomUUID(),
        quantity: 1,
        reason: 'Unauthorized count',
        type: 'ADJUSTMENT_IN',
      });

    expect(response.status).toBe(403);
  });
});
