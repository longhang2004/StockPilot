import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('tenant database isolation', () => {
  const adminDatabaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';

  let admin: Awaited<ReturnType<typeof createClient>>;
  let app: Awaited<ReturnType<typeof createClient>>;

  async function createClient(connectionString: string) {
    const { createPrismaClient } =
      await import('../src/database/prisma-client.js');
    return createPrismaClient(connectionString);
  }

  beforeAll(async () => {
    admin = await createClient(adminDatabaseUrl);
    app = await createClient(appDatabaseUrl);
  });

  afterAll(async () => {
    if (admin) {
      await admin.organization.deleteMany({
        where: { slug: { startsWith: 'rls-test-' } },
      });
      await admin.$disconnect();
    }
    if (app) {
      await app.$disconnect();
    }
  });

  it('returns only rows belonging to the transaction organization context', async () => {
    const { TenantDatabase } =
      await import('../src/database/tenant-database.js');
    const tenantDatabase = new TenantDatabase(app);
    const suffix = randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      admin.organization.create({
        data: { name: 'RLS Test A', slug: `rls-test-a-${suffix}` },
      }),
      admin.organization.create({
        data: { name: 'RLS Test B', slug: `rls-test-b-${suffix}` },
      }),
    ]);

    const warehouseA = await tenantDatabase.withTenant(
      { organizationId: organizationA.id },
      (transaction) =>
        transaction.warehouse.create({
          data: {
            name: 'Warehouse A',
            organizationId: organizationA.id,
          },
        }),
    );
    await tenantDatabase.withTenant(
      { organizationId: organizationB.id },
      (transaction) =>
        transaction.warehouse.create({
          data: {
            name: 'Warehouse B',
            organizationId: organizationB.id,
          },
        }),
    );

    const visibleToA = await tenantDatabase.withTenant(
      { organizationId: organizationA.id },
      (transaction) => transaction.warehouse.findMany(),
    );
    const warehouseAFromB = await tenantDatabase.withTenant(
      { organizationId: organizationB.id },
      (transaction) =>
        transaction.warehouse.findFirst({ where: { id: warehouseA.id } }),
    );

    expect(visibleToA).toHaveLength(1);
    expect(visibleToA[0]?.organizationId).toBe(organizationA.id);
    expect(warehouseAFromB).toBeNull();
    await expect(app.warehouse.findMany()).resolves.toEqual([]);
  });

  it('enforces one warehouse per organization', async () => {
    const { TenantDatabase } =
      await import('../src/database/tenant-database.js');
    const tenantDatabase = new TenantDatabase(app);
    const organization = await admin.organization.create({
      data: {
        name: 'RLS Warehouse Constraint',
        slug: `rls-test-constraint-${randomUUID()}`,
      },
    });

    await tenantDatabase.withTenant(
      { organizationId: organization.id },
      (transaction) =>
        transaction.warehouse.create({
          data: { name: 'Primary', organizationId: organization.id },
        }),
    );

    await expect(
      tenantDatabase.withTenant(
        { organizationId: organization.id },
        (transaction) =>
          transaction.warehouse.create({
            data: { name: 'Second', organizationId: organization.id },
          }),
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('isolates catalog rows and makes the stock ledger append-only for the app role', async () => {
    const { TenantDatabase } =
      await import('../src/database/tenant-database.js');
    const tenantDatabase = new TenantDatabase(app);
    const suffix = randomUUID();
    const [organizationA, organizationB] = await Promise.all([
      admin.organization.create({
        data: { name: 'Catalog RLS A', slug: `rls-test-catalog-a-${suffix}` },
      }),
      admin.organization.create({
        data: { name: 'Catalog RLS B', slug: `rls-test-catalog-b-${suffix}` },
      }),
    ]);
    const [warehouseA] = await Promise.all([
      tenantDatabase.withTenant(
        { organizationId: organizationA.id },
        (transaction) =>
          transaction.warehouse.create({
            data: { name: 'Warehouse A', organizationId: organizationA.id },
          }),
      ),
      tenantDatabase.withTenant(
        { organizationId: organizationB.id },
        (transaction) =>
          transaction.warehouse.create({
            data: { name: 'Warehouse B', organizationId: organizationB.id },
          }),
      ),
    ]);
    const productA = await tenantDatabase.withTenant(
      { organizationId: organizationA.id },
      (transaction) =>
        transaction.product.create({
          data: {
            name: 'Tenant A Product',
            organizationId: organizationA.id,
            reorderPoint: 2,
            salePrice: '10.00',
            sku: `A-${suffix}`,
          },
        }),
    );
    await tenantDatabase.withTenant(
      { organizationId: organizationB.id },
      (transaction) =>
        transaction.product.create({
          data: {
            name: 'Tenant B Product',
            organizationId: organizationB.id,
            reorderPoint: 2,
            salePrice: '10.00',
            sku: `B-${suffix}`,
          },
        }),
    );

    const visibleProducts = await tenantDatabase.withTenant(
      { organizationId: organizationA.id },
      (transaction) => transaction.product.findMany(),
    );
    expect(visibleProducts.map((product) => product.id)).toEqual([productA.id]);
    await expect(app.product.findMany()).resolves.toEqual([]);
    await expect(
      tenantDatabase.withTenant(
        { organizationId: organizationA.id },
        (transaction) =>
          transaction.product.create({
            data: {
              name: 'Cross-tenant write',
              organizationId: organizationB.id,
              reorderPoint: 0,
              salePrice: '1.00',
              sku: `CROSS-${suffix}`,
            },
          }),
      ),
    ).rejects.toBeDefined();

    const movement = await tenantDatabase.withTenant(
      { organizationId: organizationA.id },
      (transaction) =>
        transaction.stockMovement.create({
          data: {
            onHandAfter: 1,
            organizationId: organizationA.id,
            productId: productA.id,
            quantityDelta: 1,
            referenceId: randomUUID(),
            referenceType: 'TEST_RECEIPT',
            type: 'RECEIPT',
            warehouseId: warehouseA.id,
          },
        }),
    );
    await expect(
      tenantDatabase.withTenant(
        { organizationId: organizationA.id },
        (transaction) =>
          transaction.stockMovement.update({
            data: { reason: 'Ledger rewrite attempt' },
            where: { id: movement.id },
          }),
      ),
    ).rejects.toBeDefined();
    await expect(
      tenantDatabase.withTenant(
        { organizationId: organizationA.id },
        (transaction) =>
          transaction.stockMovement.delete({ where: { id: movement.id } }),
      ),
    ).rejects.toBeDefined();
  });
});
