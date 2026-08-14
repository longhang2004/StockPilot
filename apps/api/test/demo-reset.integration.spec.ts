import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEMO_FIXTURE_COUNTS } from '../src/demo/demo-fixture.js';
import { createTestAgent, demoLogin } from './support/agent.js';
import { adminDatabaseUrl, setTestEnvironment } from './support/environment.js';
import {
  createAdminClient,
  createTestApplication,
} from './support/test-app.js';

describe('demo reset API', () => {
  const demoSlug = `reset-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let owner: Awaited<ReturnType<typeof createTestAgent>>;
  let ownerCsrf: string;
  let manager: Awaited<ReturnType<typeof createTestAgent>>;
  let managerCsrf: string;

  beforeAll(async () => {
    setTestEnvironment({
      CSRF_SECRET: 'demo-reset-csrf-secret-with-at-least-32-characters',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      WEBHOOK_SIGNING_SECRET: 'demo-reset-webhook-secret',
    });
    admin = await createAdminClient(adminDatabaseUrl());
    const { seedDemoIdentity } = await import('../prisma/seed.js');
    await seedDemoIdentity(admin, { slug: demoSlug });
    ({ app } = await createTestApplication());
    const ownerAgent = createTestAgent(app);
    ({ csrfToken: ownerCsrf } = await demoLogin(ownerAgent, 'OWNER'));
    owner = ownerAgent;
    const managerAgent = createTestAgent(app);
    ({ csrfToken: managerCsrf } = await demoLogin(managerAgent, 'MANAGER'));
    manager = managerAgent;
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
      .set('Origin', 'http://localhost:3000')
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
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Reset Me Customer' });
    expect(customer.status).toBe(201);
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: 'Reset Me Supplier' });
    const receipt = await manager
      .post('/v1/receipts')
      .set('Origin', 'http://localhost:3000')
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
      .set('Origin', 'http://localhost:3000')
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
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', ownerCsrf)
      .set('Idempotency-Key', 'demo-reset-1')
      .send();
    expect(replay.status).toBe(200);
    expect(replay.body.resetAt).toBe(reset.body.resetAt);

    expect((await manager.get('/v1/products')).body.total).toBe(
      DEMO_FIXTURE_COUNTS.activeProducts,
    );
    expect((await manager.get('/v1/customers')).body.total).toBe(
      DEMO_FIXTURE_COUNTS.customers,
    );
    expect((await manager.get('/v1/inventory/balances')).body.total).toBe(8);
    const audit = await owner.get('/v1/audit-events');
    expect(audit.body.items.length).toBeGreaterThan(1);
    expect(
      audit.body.items.some(
        (item: { action: string }) => item.action === 'DEMO_RESET',
      ),
    ).toBe(true);
  });

  it('automatically resets a due demo on the next demo login', async () => {
    await admin.organization.update({
      data: { nextDemoResetAt: new Date(Date.now() - 1_000) },
      where: { slug: demoSlug },
    });
    const product = await manager
      .post('/v1/products')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Auto Reset Product',
        reorderPoint: 0,
        salePrice: '2.00',
        sku: `AUTO-${randomUUID().slice(0, 8)}`,
      });
    expect(product.status).toBe(201);

    const freshSession = createTestAgent(app);
    const login = await freshSession
      .post('/v1/auth/demo-login')
      .set('Origin', 'http://localhost:3000')
      .send({ role: 'STAFF' });
    expect(login.status).toBe(200);
    expect((await manager.get('/v1/products')).body.total).toBe(
      DEMO_FIXTURE_COUNTS.activeProducts,
    );
  });
});
