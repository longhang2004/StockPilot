import 'dotenv/config';

import { pathToFileURL } from 'node:url';

import { hash } from 'argon2';

import { createPrismaClient } from '../src/database/prisma-client.js';
import type { PrismaClient, Role } from '../src/generated/prisma/client.js';

const demoUsers: ReadonlyArray<{
  displayName: string;
  emailPrefix: string;
  role: Role;
}> = [
  { displayName: 'Olivia Owner', emailPrefix: 'owner', role: 'OWNER' },
  { displayName: 'Morgan Manager', emailPrefix: 'manager', role: 'MANAGER' },
  { displayName: 'Sam Staff', emailPrefix: 'staff', role: 'STAFF' },
];

export interface DemoSeedOptions {
  slug?: string;
}

export async function seedDemoIdentity(
  prisma: PrismaClient,
  options: DemoSeedOptions = {},
): Promise<void> {
  const slug = options.slug ?? 'stockpilot-demo';
  const organization = await prisma.organization.upsert({
    create: {
      currency: 'USD',
      isDemo: true,
      name: 'Harbor & Pine Wholesale',
      nextDemoResetAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      slug,
    },
    update: {
      currency: 'USD',
      isDemo: true,
      name: 'Harbor & Pine Wholesale',
    },
    where: { slug },
  });

  await prisma.warehouse.upsert({
    create: {
      name: 'Main Warehouse',
      organizationId: organization.id,
    },
    update: { name: 'Main Warehouse' },
    where: { organizationId: organization.id },
  });

  const passwordHash = await hash('StockPilotDemo!');
  for (const demoUser of demoUsers) {
    const email = `${demoUser.emailPrefix}@${slug}.stockpilot.test`;
    const user = await prisma.user.upsert({
      create: {
        displayName: demoUser.displayName,
        email,
        passwordHash,
      },
      update: {
        displayName: demoUser.displayName,
        passwordHash,
      },
      where: { email },
    });

    await prisma.membership.upsert({
      create: {
        organizationId: organization.id,
        role: demoUser.role,
        userId: user.id,
      },
      update: { role: demoUser.role },
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
    });
  }
}

async function main(): Promise<void> {
  const connectionString =
    process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required.');
  }

  const prisma = createPrismaClient(connectionString);
  try {
    await seedDemoIdentity(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) {
  await main();
}
