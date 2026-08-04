import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('catalog and partners API', () => {
  const adminDatabaseUrl =
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const demoSlug = `catalog-test-${randomUUID()}`;
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
      CSRF_SECRET: 'catalog-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'true',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      NODE_ENV: 'test',
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: 'catalog-webhook-secret',
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

  it('lets a Manager create and list a normalized product', async () => {
    const created = await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: '  Organic Oat Milk  ',
        reorderPoint: 16,
        salePrice: '42.50',
        sku: ' oat-12 ',
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Organic Oat Milk',
      reorderPoint: 16,
      salePrice: '42.50',
      sku: 'OAT-12',
    });

    const listed = await manager.get('/v1/products?search=oat');
    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0].sku).toBe('OAT-12');

    const audit = await manager.get('/v1/audit-events?entityType=Product');
    expect(audit.status).toBe(200);
    expect(
      audit.body.items.some(
        (event: { action: string; entityId: string }) =>
          event.action === 'PRODUCT_CREATED' &&
          event.entityId === created.body.id,
      ),
    ).toBe(true);
  });

  it('returns RFC 9457 problem details for invalid input', async () => {
    const response = await manager
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('X-Request-Id', 'catalog-validation-trace')
      .send({ name: 'x' });

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      traceId: 'catalog-validation-trace',
      type: 'https://stockpilot.dev/problems/validation-error',
    });
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'sku' })]),
    );
  });

  it('prevents Staff from mutating catalog data', async () => {
    const response = await staff
      .post('/v1/products')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', staffCsrf)
      .send({
        name: 'Restricted Product',
        reorderPoint: 4,
        salePrice: '8.00',
        sku: 'NO-STAFF-WRITE',
      });

    expect(response.status).toBe(403);
    expect((await staff.get('/v1/audit-events')).status).toBe(403);
  });

  it('creates minimal customer and supplier records in the active organization', async () => {
    const customer = await manager
      .post('/v1/customers')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        companyName: 'Northstar Market',
        contactName: 'Avery Chen',
        email: 'orders@northstar.example',
      });
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        companyName: 'Greenway Foods',
        email: 'supply@greenway.example',
      });

    expect(customer.status).toBe(201);
    expect(customer.body).toMatchObject({
      companyName: 'Northstar Market',
      phone: null,
    });
    expect(supplier.status).toBe(201);
    expect(supplier.body).toMatchObject({
      companyName: 'Greenway Foods',
      contactName: null,
    });
  });

  it('returns a tenant-scoped operational overview', async () => {
    const response = await manager.get('/v1/dashboard/overview');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      exceptions: {
        failedIntegrations: 0,
        openLowStockAlerts: 0,
        ordersAwaitingApproval: 0,
      },
      openOrderValue: '0.00',
    });
    expect(response.body.recentOrders).toEqual([]);
    expect(response.body.recentMovements).toEqual([]);
    expect(response.body.fourteenDayMovements).toEqual([]);
  });

  it('previews and commits valid product CSV rows without blocking invalid rows', async () => {
    const preview = await manager
      .post('/v1/product-imports/preview')
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        fileName: 'catalog.csv',
        content: [
          'sku,name,sale_price,reorder_point,description',
          'COF-1,Cold Brew Concentrate,18.50,8,Ready to pour',
          ',Missing price,,3,Invalid row',
          'OAT-12,Duplicate existing SKU,9.99,2,Invalid row',
        ].join('\n'),
      });

    expect(preview.status).toBe(201);
    expect(preview.body).toMatchObject({
      rowsTotal: 3,
      rowsValid: 1,
      rowsInvalid: 2,
      status: 'PREVIEW',
    });
    expect(preview.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'sale_price', row: 3 }),
        expect.objectContaining({ field: 'sku', row: 3 }),
        expect.objectContaining({ field: 'sku', row: 4 }),
      ]),
    );

    const committed = await manager
      .post(`/v1/product-imports/${preview.body.id}/commit`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', 'catalog-import-commit-1');

    expect(committed.status).toBe(200);
    expect(committed.body).toMatchObject({
      created: 1,
      run: { id: preview.body.id, status: 'COMMITTED' },
    });

    const replay = await manager
      .post(`/v1/product-imports/${preview.body.id}/commit`)
      .set('Origin', webOrigin)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', 'catalog-import-commit-1');
    expect(replay.status).toBe(200);
    expect(replay.body.created).toBe(1);

    const errors = await manager.get(
      `/v1/product-imports/${preview.body.id}/errors.csv`,
    );
    expect(errors.status).toBe(200);
    expect(errors.headers['content-type']).toContain('text/csv');
    expect(errors.text).toContain('row,field,message');
    expect(errors.text).toContain('sale_price');

    const exported = await manager.get('/v1/products/export.csv');
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('COF-1,Cold Brew Concentrate,18.50,8');
  });
});
