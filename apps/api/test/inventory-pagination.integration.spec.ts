import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { InventorySummarySchema } from '@stockpilot/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestAgent, demoLogin } from './support/agent.js';
import { adminDatabaseUrl, setTestEnvironment } from './support/environment.js';
import {
  createAdminClient,
  createTestApplication,
} from './support/test-app.js';

describe('inventory filtering, pagination and organization totals', () => {
  const slug = `inventory-pages-${randomUUID()}`;
  const otherSlug = `${slug}-other`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let manager: ReturnType<typeof createTestAgent>;
  let productIds: string[];

  beforeAll(async () => {
    setTestEnvironment({ DEMO_ORGANIZATION_SLUG: slug });
    admin = await createAdminClient(adminDatabaseUrl());
    const { seedDemoIdentity } = await import('../prisma/seed.js');
    await seedDemoIdentity(admin, { seedFixture: false, slug });
    await seedDemoIdentity(admin, { seedFixture: false, slug: otherSlug });
    for (const organizationSlug of [slug, otherSlug]) {
      const organization = await admin.organization.findUniqueOrThrow({
        where: { slug: organizationSlug },
      });
      const warehouse = await admin.warehouse.findUniqueOrThrow({
        where: { organizationId: organization.id },
      });
      const count = organizationSlug === slug ? 250 : 1;
      const products = Array.from({ length: count }, (_, index) => ({
        id: randomUUID(),
        name: `Inventory item ${String(index).padStart(3, '0')}`,
        sku: `BULK-${String(index).padStart(3, '0')}`,
        organizationId: organization.id,
        reorderPoint: 10,
        salePrice: '10.00',
      }));
      if (organizationSlug === slug)
        productIds = products.map((product) => product.id);
      await admin.product.createMany({ data: products });
      await admin.inventoryBalance.createMany({
        data: products.map((product) => ({
          organizationId: organization.id,
          warehouseId: warehouse.id,
          productId: product.id,
          onHand: 10,
          reserved: 2,
        })),
      });
      await admin.lowStockAlert.createMany({
        data: products.map((product, index) => ({
          organizationId: organization.id,
          warehouseId: warehouse.id,
          productId: product.id,
          availableAtOpen: 4,
          reorderPoint: 10,
          status: index < 150 ? 'OPEN' : 'RESOLVED',
          resolvedAt: index < 150 ? null : new Date(),
        })),
      });
      await admin.stockMovement.createMany({
        data: products.flatMap((product) => [
          {
            organizationId: organization.id,
            warehouseId: warehouse.id,
            productId: product.id,
            type: 'RECEIPT' as const,
            quantityDelta: 9,
            onHandAfter: 9,
            referenceType: 'GOODS_RECEIPT',
            referenceId: randomUUID(),
            createdAt: new Date('2026-08-01T00:00:00Z'),
          },
          {
            organizationId: organization.id,
            warehouseId: warehouse.id,
            productId: product.id,
            type: 'ADJUSTMENT_IN' as const,
            quantityDelta: 1,
            onHandAfter: 10,
            referenceType: 'ADJUSTMENT',
            referenceId: randomUUID(),
            reason: 'Fixture adjustment for pagination coverage',
            createdAt: new Date('2026-08-02T00:00:00Z'),
          },
        ]),
      });
    }
    ({ app } = await createTestApplication());
    manager = createTestAgent(app);
    await demoLogin(manager, 'MANAGER');
  });

  afterAll(async () => {
    await app?.close();
    if (admin) {
      await admin.organization.deleteMany({
        where: { slug: { in: [slug, otherSlug] } },
      });
      await admin.user.deleteMany({
        where: {
          OR: [
            { email: { endsWith: `@${slug}.stockpilot.test` } },
            { email: { endsWith: `@${otherSlug}.stockpilot.test` } },
          ],
        },
      });
      await admin.$disconnect();
    }
  });

  it('returns all 250 balances across pages and searches beyond the first 100', async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        manager.get(`/v1/inventory/balances?pageSize=100&page=${page}`),
      ),
    );
    expect(pages.map((page) => page.body.items.length)).toEqual([100, 100, 50]);
    expect(pages[0].body).toMatchObject({ total: 250, totalPages: 3 });
    expect(
      new Set(
        pages.flatMap((page) =>
          page.body.items.map((item: { productId: string }) => item.productId),
        ),
      ).size,
    ).toBe(250);
    const search = await manager.get(
      '/v1/inventory/balances?search=bulk-249&pageSize=25',
    );
    expect(search.status).toBe(200);
    expect(search.body).toMatchObject({
      total: 1,
      items: [{ productId: productIds[249] }],
    });
    const name = await manager.get('/v1/inventory/balances?search=ITEM%20249');
    expect(name.body.total).toBe(1);
  });

  it('filters movement type before pagination even when 250 newer adjustments exist', async () => {
    const recent = await manager.get('/v1/inventory/movements?pageSize=100');
    expect(
      recent.body.items.every(
        (item: { type: string }) => item.type === 'ADJUSTMENT_IN',
      ),
    ).toBe(true);
    const receipts = await manager.get(
      '/v1/inventory/movements?type=RECEIPT&pageSize=100&page=3',
    );
    expect(receipts.status).toBe(200);
    expect(receipts.body).toMatchObject({ total: 250, totalPages: 3 });
    expect(receipts.body.items).toHaveLength(50);
    expect(
      receipts.body.items.every(
        (item: { type: string }) => item.type === 'RECEIPT',
      ),
    ).toBe(true);
    const search = await manager.get(
      '/v1/inventory/movements?type=RECEIPT&search=bulk-249',
    );
    expect(search.body).toMatchObject({
      total: 1,
      items: [{ productId: productIds[249], type: 'RECEIPT' }],
    });
    expect(
      (await manager.get('/v1/inventory/movements?type=UNKNOWN')).status,
    ).toBe(400);
  });

  it('keeps totals tenant scoped and independent of list pages, search and resolved alert filters', async () => {
    const before = await manager.get('/v1/inventory/summary');
    expect(before.status).toBe(200);
    expect(InventorySummarySchema.parse(before.body)).toEqual({
      trackedSkus: 250,
      availableUnits: 2000,
      openAlerts: 150,
    });
    const resolved = await manager.get(
      '/v1/alerts?status=RESOLVED&pageSize=25&page=2',
    );
    expect(resolved.body).toMatchObject({ total: 100, page: 2 });
    expect(resolved.body.items).toHaveLength(25);
    const narrowed = await manager.get(
      '/v1/inventory/balances?search=bulk-249',
    );
    expect(narrowed.body.total).toBe(1);
    const after = await manager.get(
      '/v1/inventory/summary?search=bulk-249&page=3&status=RESOLVED',
    );
    expect(after.body).toEqual(before.body);
  });
});
