import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
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
import { MAX_FILE_BYTES } from '../src/imports/product-csv-parser.js';

describe('catalog and partners API', () => {
  const demoSlug = `catalog-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: Awaited<ReturnType<typeof createTestAgent>>;
  let managerCsrf: string;
  let staff: Awaited<ReturnType<typeof createTestAgent>>;
  let staffCsrf: string;

  beforeAll(async () => {
    setTestEnvironment({
      CSRF_SECRET: 'catalog-csrf-secret-with-at-least-32-characters',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      WEBHOOK_SIGNING_SECRET: 'catalog-webhook-secret',
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
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        companyName: 'Northstar Market',
        contactName: 'Avery Chen',
        email: 'orders@northstar.example',
      });
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', TEST_WEB_ORIGIN)
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
    // The chart contract is a zero-filled, consecutive 14-day window so the
    // bars and "Last 14 days" label stay truthful even on quiet days.
    const days = response.body.fourteenDayMovements.map(
      (row: { day: string }) => row.day,
    );
    expect(days).toHaveLength(14);
    expect(new Set(days).size).toBe(14);
    for (let index = 1; index < days.length; index += 1) {
      expect(Date.parse(days[index]!) - Date.parse(days[index - 1]!)).toBe(
        24 * 60 * 60 * 1000,
      );
    }
    expect(
      response.body.fourteenDayMovements.every(
        (row: { inbound: number; outbound: number }) =>
          row.inbound === 0 && row.outbound === 0,
      ),
    ).toBe(true);
  });

  it('previews and commits valid product CSV rows without blocking invalid rows', async () => {
    const preview = await manager
      .post('/v1/product-imports/preview')
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', 'catalog-import-commit-1');

    expect(committed.status).toBe(200);
    expect(committed.body).toMatchObject({
      created: 1,
      run: { id: preview.body.id, status: 'COMMITTED' },
    });

    const replay = await manager
      .post(`/v1/product-imports/${preview.body.id}/commit`)
      .set('Origin', TEST_WEB_ORIGIN)
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

  it('accepts CSV previews larger than 100 KiB through the real JSON transport', async () => {
    const content = [
      'sku,name,sale_price,reorder_point,description',
      ...Array.from(
        { length: 150 },
        (_, index) =>
          `BULK-${index},Bulk product ${index},10.00,0,${'x'.repeat(1000)}`,
      ),
    ].join('\n');
    expect(Buffer.byteLength(content)).toBeGreaterThan(100 * 1024);
    const preview = await manager
      .post('/v1/product-imports/preview')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({ fileName: 'bulk.csv', content });
    expect(preview.status).toBe(201);
    expect(preview.body).toMatchObject({ rowsTotal: 150, rowsValid: 150 });
  });

  it('enforces decoded CSV bytes while allowing worst-case JSON escaping', async () => {
    const prefix =
      'sku,name,sale_price,reorder_point,description\nLIMIT,Limit product,10.00,0,';
    // NUL takes six bytes in JSON. The row is invalid, but transport and the
    // CSV file size limit must still accept a file of exactly 2 MiB.
    const content =
      prefix + '\0'.repeat(MAX_FILE_BYTES - Buffer.byteLength(prefix));
    const preview = await manager
      .post('/v1/product-imports/preview')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({ fileName: 'escaped.csv', content });
    expect(preview.status).toBe(201);
    expect(preview.body).toMatchObject({ rowsTotal: 1, rowsInvalid: 1 });

    const oversizedFile = await manager
      .post('/v1/product-imports/preview')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({ fileName: 'oversized.csv', content: content + 'x' });
    expect(oversizedFile.status).toBe(400);
    expect(oversizedFile.body.detail).toContain('2 MB limit');
  });

  it('keeps other JSON endpoints at 100 KiB and maps parser errors to problem details', async () => {
    const normalEndpoint = await manager
      .post('/v1/products')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({ name: 'x'.repeat(100 * 1024) });
    expect(normalEndpoint.status).toBe(413);
    expect(normalEndpoint.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(normalEndpoint.body).toMatchObject({ status: 413 });

    const malformed = await manager
      .post('/v1/product-imports/preview')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Content-Type', 'application/json')
      .send('{"content":');
    expect(malformed.status).toBe(400);
    expect(malformed.headers['content-type']).toContain(
      'application/problem+json',
    );

    const oversizedEnvelope = await manager
      .post('/v1/product-imports/preview')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        content: 'x'.repeat(MAX_FILE_BYTES * 6 + 4096),
        fileName: 'huge.csv',
      });
    expect(oversizedEnvelope.status).toBe(413);
    expect(oversizedEnvelope.body).toMatchObject({ status: 413 });
  });
});
