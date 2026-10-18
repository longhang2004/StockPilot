import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import {
  InventoryProductTraceSchema,
  ReceiptDetailSchema,
  ReceiptResultSchema,
} from '@stockpilot/contracts';
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

describe('inventory receipts and adjustments API', () => {
  const demoSlug = `inventory-test-${randomUUID()}`;
  const foreignSlug = `inventory-foreign-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: Awaited<ReturnType<typeof createTestAgent>>;
  let managerCsrf: string;
  let staff: Awaited<ReturnType<typeof createTestAgent>>;
  let staffCsrf: string;
  let foreignReceiptId: string;
  let foreignProductId: string;

  beforeAll(async () => {
    setTestEnvironment({
      CSRF_SECRET: 'inventory-csrf-secret-with-at-least-32-characters',
      DEMO_ORGANIZATION_SLUG: demoSlug,
      WEBHOOK_SIGNING_SECRET: 'inventory-webhook-secret',
    });

    admin = await createAdminClient(adminDatabaseUrl());
    const { seedDemoIdentity } = await import('../prisma/seed.js');
    await seedDemoIdentity(admin, { seedFixture: false, slug: demoSlug });
    await seedDemoIdentity(admin, { seedFixture: false, slug: foreignSlug });
    const foreignOrganization = await admin.organization.findUniqueOrThrow({
      where: { slug: foreignSlug },
    });
    const foreignWarehouse = await admin.warehouse.findUniqueOrThrow({
      where: { organizationId: foreignOrganization.id },
    });
    const foreignSupplier = await admin.supplier.create({
      data: {
        companyName: 'Foreign Supplier',
        organizationId: foreignOrganization.id,
      },
    });
    const foreignProduct = await admin.product.create({
      data: {
        name: 'Foreign Product',
        organizationId: foreignOrganization.id,
        reorderPoint: 0,
        salePrice: '10.00',
        sku: `FOREIGN-${randomUUID().slice(0, 8)}`,
      },
    });
    const foreignReceipt = await admin.goodsReceipt.create({
      data: {
        organizationId: foreignOrganization.id,
        receiptNumber: `FOREIGN-${randomUUID()}`,
        receivedAt: new Date(),
        supplierId: foreignSupplier.id,
        warehouseId: foreignWarehouse.id,
        lines: {
          create: {
            productId: foreignProduct.id,
            quantity: 3,
          },
        },
      },
    });
    foreignReceiptId = foreignReceipt.id;
    foreignProductId = foreignProduct.id;

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
      await admin.organization.deleteMany({
        where: { slug: { in: [demoSlug, foreignSlug] } },
      });
      await admin.user.deleteMany({
        where: {
          OR: [
            { email: { endsWith: `@${demoSlug}.stockpilot.test` } },
            { email: { endsWith: `@${foreignSlug}.stockpilot.test` } },
          ],
        },
      });
      await admin.$disconnect();
    }
  });

  it('hides receipt and product trace identifiers owned by another tenant', async () => {
    expect((await manager.get(`/v1/receipts/${foreignReceiptId}`)).status).toBe(
      404,
    );
    expect(
      (await manager.get(`/v1/inventory/products/${foreignProductId}/trace`))
        .status,
    ).toBe(404);
    const foreignSearch = await manager.get(
      `/v1/receipts?search=${encodeURIComponent(foreignReceiptId)}&pageSize=100`,
    );
    expect(foreignSearch.body.total).toBe(0);
  });

  it('groups multi-line receipt documents and paginates supplier search results', async () => {
    const supplierName = `Pagination Supplier ${randomUUID().slice(0, 8)}`;
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({ companyName: supplierName });
    const productA = await manager
      .post('/v1/products')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Pagination Product A',
        reorderPoint: 0,
        salePrice: '10.00',
        sku: `PAG-A-${randomUUID().slice(0, 8)}`,
      });
    const productB = await manager
      .post('/v1/products')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Pagination Product B',
        reorderPoint: 0,
        salePrice: '10.00',
        sku: `PAG-B-${randomUUID().slice(0, 8)}`,
      });
    expect([supplier.status, productA.status, productB.status]).toEqual([
      201, 201, 201,
    ]);
    const latestNumber = `PAGE-LATEST-${randomUUID()}`;
    const earlierNumber = `PAGE-EARLIER-${randomUUID()}`;
    const createReceipt = (
      receiptNumber: string,
      receivedAt: string,
      lines: Array<{ productId: string; quantity: number }>,
    ) =>
      manager
        .post('/v1/receipts')
        .set('Origin', TEST_WEB_ORIGIN)
        .set('X-CSRF-Token', managerCsrf)
        .set('Idempotency-Key', `pagination-${randomUUID()}`)
        .send({
          receiptNumber,
          receivedAt,
          supplierId: supplier.body.id,
          lines,
        });
    const earlier = await createReceipt(
      earlierNumber,
      '2026-08-05T00:00:00.000Z',
      [
        { productId: productA.body.id, quantity: 2 },
        { productId: productB.body.id, quantity: 4 },
      ],
    );
    const latest = await createReceipt(
      latestNumber,
      '2026-08-06T00:00:00.000Z',
      [{ productId: productA.body.id, quantity: 3 }],
    );
    expect([earlier.status, latest.status]).toEqual([201, 201]);

    const pageOne = await manager.get(
      `/v1/receipts?search=${encodeURIComponent(supplierName)}&page=1&pageSize=1`,
    );
    const pageTwo = await manager.get(
      `/v1/receipts?search=${encodeURIComponent(supplierName)}&page=2&pageSize=1`,
    );
    expect(pageOne.body).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      items: [{ id: latest.body.id, receiptNumber: latestNumber }],
    });
    expect(pageTwo.body).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      items: [
        {
          id: earlier.body.id,
          receiptNumber: earlierNumber,
          lineCount: 2,
          totalQuantity: 6,
        },
      ],
    });
    const detail = await manager.get(`/v1/receipts/${earlier.body.id}`);
    expect(detail.body.lines).toHaveLength(2);
    expect(detail.body.totalQuantity).toBe(6);
  });

  it('applies receipts atomically, replays idempotent responses, and reconciles low stock', async () => {
    const product = await manager
      .post('/v1/products')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Shelf Stable Oat Milk',
        reorderPoint: 5,
        salePrice: '42.50',
        sku: `OAT-${randomUUID().slice(0, 8)}`,
      });
    const supplier = await manager
      .post('/v1/suppliers')
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', idempotencyKey)
      .send(receiptPayload);
    const replay = await manager
      .post('/v1/receipts')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', idempotencyKey)
      .send(receiptPayload);

    expect(receipt.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(ReceiptResultSchema.parse(receipt.body).id).toBe(receipt.body.id);
    expect(replay.body.id).toBe(receipt.body.id);
    expect(receipt.body.lines[0]).toMatchObject({
      productId: product.body.id,
      quantity: 12,
      unitCost: '18.50',
    });

    const documents = await manager.get(
      `/v1/receipts?search=${encodeURIComponent(receiptPayload.receiptNumber)}&page=1&pageSize=1`,
    );
    expect(documents.status).toBe(200);
    expect(documents.body).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      items: [
        {
          id: receipt.body.id,
          receiptNumber: receiptPayload.receiptNumber,
          supplier: { id: supplier.body.id, companyName: 'Greenway Foods' },
          lineCount: 1,
          totalQuantity: 12,
        },
      ],
    });
    const documentDetail = await manager.get(`/v1/receipts/${receipt.body.id}`);
    expect(documentDetail.status).toBe(200);
    expect(documentDetail.body).toMatchObject({
      id: receipt.body.id,
      receivedAt: receiptPayload.receivedAt,
      createdAt: expect.any(String),
      lines: [
        {
          goodsReceiptId: receipt.body.id,
          productId: product.body.id,
          product: { name: 'Shelf Stable Oat Milk', sku: product.body.sku },
          quantity: 12,
          unitCost: '18.50',
        },
      ],
    });
    expect(documentDetail.body).not.toHaveProperty('updatedAt');
    expect(ReceiptDetailSchema.parse(documentDetail.body).id).toBe(
      receipt.body.id,
    );
    expect((await manager.get(`/v1/receipts/${randomUUID()}`)).status).toBe(
      404,
    );

    const conflictingRetry = await manager
      .post('/v1/receipts')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        ...receiptPayload,
        lines: [{ productId: product.body.id, quantity: 11 }],
      });
    expect(conflictingRetry.status).toBe(409);

    let balances = await manager.get(
      `/v1/inventory/balances?search=${encodeURIComponent(product.body.sku)}`,
    );
    let movements = await manager.get(
      `/v1/inventory/movements?productId=${product.body.id}`,
    );
    expect(balances.body.items[0]).toMatchObject({
      available: 12,
      onHand: 12,
      productId: product.body.id,
      reserved: 0,
    });
    expect(movements.body.items).toHaveLength(1);
    const receiptTrace = await manager.get(
      `/v1/inventory/products/${product.body.id}/trace?reservationsPage=1&reservationsPageSize=1&movementsPage=1&movementsPageSize=1`,
    );
    expect(receiptTrace.status).toBe(200);
    expect(
      InventoryProductTraceSchema.parse(receiptTrace.body).product.id,
    ).toBe(product.body.id);
    expect(receiptTrace.body).toMatchObject({
      product: { id: product.body.id, sku: product.body.sku },
      balance: { onHand: 12, reserved: 0, available: 12 },
      reservations: { total: 0, items: [] },
      movements: {
        total: 1,
        items: [
          {
            productId: product.body.id,
            type: 'RECEIPT',
            referenceType: 'GOODS_RECEIPT',
            referenceId: receipt.body.id,
          },
        ],
      },
    });
    const receiptAudit = await manager.get(
      `/v1/audit-events?entityId=${receipt.body.id}`,
    );
    expect(receiptAudit.status).toBe(200);
    expect(receiptAudit.body.items.length).toBeGreaterThan(0);
    expect(
      receiptAudit.body.items.every(
        (event: { entityId: string }) => event.entityId === receipt.body.id,
      ),
    ).toBe(true);

    const rejectedAdjustment = await manager
      .post('/v1/inventory/adjustments')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('X-CSRF-Token', managerCsrf)
      .set('Idempotency-Key', `adjustment-${randomUUID()}`)
      .send({
        productId: product.body.id,
        quantity: 13,
        reason: 'Damaged during cycle count',
        type: 'ADJUSTMENT_OUT',
      });
    expect(rejectedAdjustment.status).toBe(409);

    balances = await manager.get(
      `/v1/inventory/balances?search=${encodeURIComponent(product.body.sku)}`,
    );
    movements = await manager.get(
      `/v1/inventory/movements?productId=${product.body.id}`,
    );
    expect(balances.body.items[0].onHand).toBe(12);
    expect(movements.body.items).toHaveLength(1);

    const adjustmentOut = await manager
      .post('/v1/inventory/adjustments')
      .set('Origin', TEST_WEB_ORIGIN)
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
      .set('Origin', TEST_WEB_ORIGIN)
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

    // The overview chart mirrors today's ledger: the receipt (12), the two
    // earlier document fixtures (9 total), and adjustment-in (3) are inbound;
    // adjustment-out (7) is outbound, with every earlier day flat.
    const overview = await manager.get('/v1/dashboard/overview');
    expect(overview.status).toBe(200);
    const chartRows = overview.body.fourteenDayMovements as Array<{
      inbound: number;
      outbound: number;
    }>;
    expect(chartRows).toHaveLength(14);
    expect(chartRows.at(-1)).toMatchObject({ inbound: 24, outbound: 7 });
    expect(
      chartRows
        .slice(0, -1)
        .every((row) => row.inbound === 0 && row.outbound === 0),
    ).toBe(true);
  });

  it('keeps receiving and adjustment permissions away from Staff', async () => {
    const response = await staff
      .post('/v1/inventory/adjustments')
      .set('Origin', TEST_WEB_ORIGIN)
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
