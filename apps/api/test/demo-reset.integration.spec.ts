import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('demo reset API', () => {
  const adminDatabaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const demoSlug = `reset-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let owner: Agent;
  let ownerCsrf: string;
  let manager: Agent;
  let managerCsrf: string;

  async function createAdminClient() {
    const { createPrismaClient } =
      await import('../src/database/prisma-client.js');
    return createPrismaClient(adminDatabaseUrl);
  }

  async function login(role: 'OWNER' | 'MANAGER') {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/v1/auth/demo-login')
      .set('Origin', webOrigin)
      .send({ role });
    return { agent, csrfToken: response.body.csrfToken as string };
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      CSRF_SECRET: 'demo-reset-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'true',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      NODE_ENV: 'test',
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: 'demo-reset-webhook-secret',
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
    ({ agent: owner, csrfToken: ownerCsrf } = await login('OWNER'));
    ({ agent: manager, csrfToken: managerCsrf } = await login('MANAGER'));
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

  it('lets Owner reset demo operational data atomically and idempotently', async () => {
    const product = await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Reset Me Product',
        reorderPoint: 1,
        salePrice: '10.00',
        sku: `RESET-${randomUUID().slice(0, 8)}`,
      });
    expect(product.status).toBe(201);
    const customer = await manager
      .post('/v1/customers')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Reset Me Customer' });
    expect(customer.status).toBe(201);
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Reset Me Supplier' });
    const receipt = await manager
      .post('/v1/receipts')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', 'reset-receipt-1')
      .send({
        lines: [{ productId: product.body.id, quantity: 3 }],
        receiptNumber: 'RESET-GR-1',
        receivedAt: '2026-08-04T04:00:00.000Z',
        supplierId: supplier.body.id,
      });
    expect(receipt.status).toBe(201);

    const reset = await owner
      .post('/v1/organization/demo-reset')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', ownerCsrf)
      .set('Idempotency-Key', 'demo-reset-1')
      .send();
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({ organizationId: expect.any(String) });
    expect(new Date(reset.body.nextDemoResetAt).getTime()).toBeGreaterThan(
      new Date(reset.body.resetAt).getTime(),
    );

    const replay = await owner
      .post('/v1/organization/demo-reset')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', ownerCsrf)
      .set('Idempotency-Key', 'demo-reset-1')
      .send();
    expect(replay.status).toBe(200);
    expect(replay.body.resetAt).toBe(reset.body.resetAt);

    expect((await manager.get('/v1/products')).body.total).toBe(0);
    expect((await manager.get('/v1/customers')).body.total).toBe(0);
    expect((await manager.get('/v1/inventory/balances')).body.total).toBe(0);
    const audit = await owner.get('/v1/audit-events');
    expect(audit.body.items).toHaveLength(1);
    expect(audit.body.items[0].action).toBe('DEMO_RESET');
  });

  it('automatically resets a due demo on the next demo login', async () => {
    await admin.organization.update({
      data: { nextDemoResetAt: new Date(Date.now() - 1_000) },
      where: { slug: demoSlug },
    });
    const product = await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Auto Reset Product',
        reorderPoint: 0,
        salePrice: '2.00',
        sku: `AUTO-${randomUUID().slice(0, 8)}`,
      });
    expect(product.status).toBe(201);

    const freshSession = request.agent(app.getHttpServer());
    const login = await freshSession
      .post('/v1/auth/demo-login')
      .set('Origin', webOrigin)
      .send({ role: 'STAFF' });
    expect(login.status).toBe(200);
    expect((await manager.get('/v1/products')).body.total).toBe(0);
  });
});
