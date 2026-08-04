import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('demo identity seed', () => {
  const databaseUrl =
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const slug = `seed-test-${randomUUID()}`;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;

  async function createAdminClient() {
    const { createPrismaClient } =
      await import('../src/database/prisma-client.js');
    return createPrismaClient(databaseUrl);
  }

  beforeAll(async () => {
    admin = await createAdminClient();
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
    await seedDemoIdentity(admin, { slug });

    const organization = await admin.organization.findUniqueOrThrow({
      include: {
        memberships: { include: { user: true }, orderBy: { role: 'asc' } },
        warehouse: true,
      },
      where: { slug },
    });

    expect(organization.isDemo).toBe(true);
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
  });
});
