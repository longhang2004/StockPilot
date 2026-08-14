import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEMO_FIXTURE_COUNTS } from '../src/demo/demo-fixture.js';
import { adminDatabaseUrl } from './support/environment.js';
import { createAdminClient } from './support/test-app.js';

describe('demo identity seed', () => {
  const slug = `seed-test-${randomUUID()}`;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;

  beforeAll(async () => {
    admin = await createAdminClient(adminDatabaseUrl());
  });

  afterAll(async () => {
    if (admin) {
      await admin.organization.deleteMany({ where: { slug } });
      await admin.user.deleteMany({
        where: { email: { endsWith: `@${slug}.stockpilot.test` } },
      });
      await admin.$disconnect();
    }
  });

  it('is idempotent and creates exactly one account per role', async () => {
    const { seedDemoIdentity } = await import('../prisma/seed.js');

    await seedDemoIdentity(admin, { slug });
    const seededProduct = await admin.product.findFirstOrThrow({
      where: { organization: { slug }, sku: 'HP-1001' },
    });
    const editedName = 'Operator-edited fixture name';
    await admin.product.update({
      data: { name: editedName },
      where: { id: seededProduct.id },
    });
    const scheduledResetAt = new Date(Date.now() + 60 * 60 * 1000);
    await admin.organization.update({
      data: { nextDemoResetAt: scheduledResetAt },
      where: { slug },
    });
    await seedDemoIdentity(admin, { slug });

    const organization = await admin.organization.findUniqueOrThrow({
      include: {
        memberships: { include: { user: true }, orderBy: { role: 'asc' } },
        warehouse: true,
      },
      where: { slug },
    });

    expect(organization.isDemo).toBe(true);
    expect(organization.nextDemoResetAt?.getTime()).toBe(
      scheduledResetAt.getTime(),
    );
    expect(organization.warehouse?.name).toBe('Main Warehouse');
    expect(organization.memberships).toHaveLength(3);
    expect(organization.memberships.map(({ role }) => role).sort()).toEqual([
      'MANAGER',
      'OWNER',
      'STAFF',
    ]);
    expect(
      organization.memberships.every(({ user }) =>
        user.email.endsWith(`@${slug}.stockpilot.test`),
      ),
    ).toBe(true);

    const [
      products,
      customers,
      suppliers,
      balances,
      receipts,
      movements,
      alerts,
      orders,
      deliveries,
      imports,
    ] = await Promise.all([
      admin.product.findMany({ where: { organizationId: organization.id } }),
      admin.customer.count({ where: { organizationId: organization.id } }),
      admin.supplier.count({ where: { organizationId: organization.id } }),
      admin.inventoryBalance.findMany({
        where: { organizationId: organization.id },
      }),
      admin.goodsReceipt.count({ where: { organizationId: organization.id } }),
      admin.stockMovement.findMany({
        where: { organizationId: organization.id },
      }),
      admin.lowStockAlert.count({
        where: { organizationId: organization.id, status: 'OPEN' },
      }),
      admin.salesOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { organizationId: organization.id },
      }),
      admin.integrationDelivery.count({
        where: { organizationId: organization.id, status: 'FAILED' },
      }),
      admin.productImportRun.count({
        where: { organizationId: organization.id },
      }),
    ]);
    expect(products).toHaveLength(
      DEMO_FIXTURE_COUNTS.activeProducts + DEMO_FIXTURE_COUNTS.inactiveProducts,
    );
    expect(products.find((product) => product.sku === 'HP-1001')?.name).toBe(
      editedName,
    );
    expect(products.filter((product) => product.isActive)).toHaveLength(
      DEMO_FIXTURE_COUNTS.activeProducts,
    );
    expect(customers).toBe(DEMO_FIXTURE_COUNTS.customers);
    expect(suppliers).toBe(DEMO_FIXTURE_COUNTS.suppliers);
    expect(balances).toHaveLength(8);
    expect(receipts).toBe(1);
    expect(movements).toHaveLength(10);
    expect(alerts).toBe(DEMO_FIXTURE_COUNTS.lowStockAlerts);
    expect(deliveries).toBe(DEMO_FIXTURE_COUNTS.failedDeliveries);
    expect(imports).toBe(1);
    expect(
      Object.fromEntries(orders.map((row) => [row.status, row._count._all])),
    ).toEqual({
      CANCELLED: DEMO_FIXTURE_COUNTS.cancelledOrders,
      CONFIRMED: DEMO_FIXTURE_COUNTS.confirmedOrders,
      DRAFT: DEMO_FIXTURE_COUNTS.draftOrders,
      FULFILLED: DEMO_FIXTURE_COUNTS.fulfilledOrders,
    });
    for (const balance of balances) {
      const ledger = movements
        .filter((movement) => movement.productId === balance.productId)
        .reduce((sum, movement) => sum + movement.quantityDelta, 0);
      expect(ledger).toBe(balance.onHand);
      expect(balance.onHand).toBeGreaterThanOrEqual(balance.reserved);
    }
  });
});
