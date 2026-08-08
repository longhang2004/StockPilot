import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/database/prisma-client.js';

describe('analytics API', () => {
  const adminDatabaseUrl =
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot';
  const appDatabaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot';
  const webOrigin = 'http://localhost:3000';
  const slug = `analytics-test-${randomUUID()}`;
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof createPrismaClient>>;
  let ownerAgent: ReturnType<typeof request.agent>;
  let ownerCsrf: string;
  let organizationId: string;
  let warehouseId: string;
  let customerId: string;
  let ownerUserId: string;

  function api(
    agent: ReturnType<typeof request.agent>,
    method: 'get' | 'post',
    path: string,
  ) {
    const builder = agent[method](`/v1${path}`);
    if (method !== 'get') {
      builder.set('Origin', webOrigin);
      if (ownerCsrf) builder.set('X-CSRF-Token', ownerCsrf);
    }
    return builder;
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      CSRF_SECRET: 'integration-csrf-secret-with-at-least-32-characters',
      DATABASE_URL: appDatabaseUrl,
      DEMO_MODE: 'false',
      NODE_ENV: 'test',
      SESSION_COOKIE_NAME: 'stockpilot_session',
      SESSION_TTL_HOURS: '12',
      WEB_ORIGIN: webOrigin,
      WEBHOOK_SIGNING_SECRET: 'integration-webhook-secret',
    });

    admin = await createPrismaClient(adminDatabaseUrl);
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

    ownerAgent = request.agent(app.getHttpServer());
    const signup = await api(ownerAgent, 'post', '/auth/signup')
      .send({
        displayName: 'Analytics Owner',
        email: `${slug}-owner@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201);
    ownerCsrf = signup.body.csrfToken;
    const workspace = await api(ownerAgent, 'post', '/organizations')
      .send({ name: slug })
      .expect(201);
    ownerCsrf = workspace.body.csrfToken;
    organizationId = workspace.body.membership.organization.id;
    ownerUserId = workspace.body.user.id;

    // Deterministic operational data, written directly as the fixture owner.
    // The workspace already created its single warehouse, so reuse it.
    warehouseId = (
      await admin.warehouse.findUniqueOrThrow({
        where: { organizationId },
      })
    ).id;
    customerId = randomUUID();
    await admin.customer.create({
      data: {
        companyName: 'Anchor Foods',
        id: customerId,
        organizationId,
      },
    });
    const gloves = await admin.product.create({
      data: {
        id: randomUUID(),
        name: 'Nitrile Gloves L',
        organizationId,
        reorderPoint: 10,
        salePrice: '8.50',
        sku: 'AN-GLV-L',
      },
    });
    const tape = await admin.product.create({
      data: {
        id: randomUUID(),
        name: 'Packing Tape',
        organizationId,
        reorderPoint: 5,
        salePrice: '4.25',
        sku: 'AN-TAPE',
      },
    });
    for (const product of [gloves, tape]) {
      await admin.inventoryBalance.create({
        data: {
          id: randomUUID(),
          onHand: 100,
          organizationId,
          productId: product.id,
          reserved: 0,
          version: 1,
          warehouseId,
        },
      });
    }
    const now = new Date();
    const day = 86_400_000;
    await admin.stockMovement.createMany({
      data: [
        // Inbound receipt 10 days ago, outbound sales in the last week.
        {
          createdAt: new Date(now.getTime() - 10 * day),
          id: randomUUID(),
          onHandAfter: 100,
          organizationId,
          productId: gloves.id,
          quantityDelta: 100,
          referenceId: randomUUID(),
          referenceType: 'RECEIPT',
          type: 'RECEIPT',
          warehouseId,
        },
        {
          createdAt: new Date(now.getTime() - 3 * day),
          id: randomUUID(),
          onHandAfter: 96,
          organizationId,
          productId: gloves.id,
          quantityDelta: -4,
          referenceId: randomUUID(),
          referenceType: 'SALE',
          type: 'SALE',
          warehouseId,
        },
        {
          createdAt: new Date(now.getTime() - 2 * day),
          id: randomUUID(),
          onHandAfter: 94,
          organizationId,
          productId: gloves.id,
          quantityDelta: -2,
          referenceId: randomUUID(),
          referenceType: 'SALE',
          type: 'SALE',
          warehouseId,
        },
        {
          createdAt: new Date(now.getTime() - 1 * day),
          id: randomUUID(),
          onHandAfter: 94,
          organizationId,
          productId: tape.id,
          quantityDelta: -1,
          referenceId: randomUUID(),
          referenceType: 'SALE',
          type: 'SALE',
          warehouseId,
        },
      ],
    });
    await admin.salesOrder.create({
      data: {
        createdByUserId: ownerUserId,
        customerCompanyName: 'Anchor Foods',
        customerId,
        fulfilledAt: new Date(now.getTime() - 2 * day),
        id: randomUUID(),
        orderNumber: 'AN-1001',
        organizationId,
        status: 'FULFILLED',
        subtotal: '100.00',
        warehouseId,
      },
    });
    await admin.salesOrder.createMany({
      data: [
        {
          createdByUserId: ownerUserId,
          customerCompanyName: 'Anchor Foods',
          customerId,
          id: randomUUID(),
          orderNumber: 'AN-1002',
          organizationId,
          status: 'DRAFT',
          subtotal: '25.00',
          warehouseId,
        },
        {
          createdByUserId: ownerUserId,
          customerCompanyName: 'Anchor Foods',
          customerId,
          confirmedAt: new Date(now.getTime() - day),
          id: randomUUID(),
          orderNumber: 'AN-1003',
          organizationId,
          status: 'CONFIRMED',
          subtotal: '30.00',
          warehouseId,
        },
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
    if (admin) {
      await admin.organization.deleteMany({
        where: { slug: { startsWith: slug } },
      });
      await admin.user.deleteMany({
        // Scoped to this suite: parallel suites share the database and a
        // global email filter would delete their users mid-run.
        where: { email: { startsWith: `${slug}-` } },
      });
    }
  });

  it('aggregates orders, fulfillment value, and top SKUs from the ledger', async () => {
    const response = await api(ownerAgent, 'get', '/analytics').expect(200);
    const body = response.body as {
      averageFulfilledOrderValue: string;
      fulfilledOrderCount: number;
      fulfilledOrderValue: string;
      lowStockSkuCount: number;
      ordersByStatus: Array<{ count: number; status: string }>;
      topFulfilledProducts: Array<{
        name: string;
        sku: string;
        unitsFulfilled: number;
      }>;
    };
    expect(body.ordersByStatus).toEqual(
      expect.arrayContaining([
        { count: 1, status: 'DRAFT' },
        { count: 1, status: 'CONFIRMED' },
        { count: 1, status: 'FULFILLED' },
      ]),
    );
    expect(body.fulfilledOrderCount).toBe(1);
    expect(body.fulfilledOrderValue).toBe('100.00');
    expect(body.averageFulfilledOrderValue).toBe('100.00');
    expect(body.topFulfilledProducts[0]).toMatchObject({
      sku: 'AN-GLV-L',
      unitsFulfilled: 6,
    });
    expect(body.lowStockSkuCount).toBe(0);
  });

  it('never aggregates across tenants', async () => {
    const other = request.agent(app.getHttpServer());
    const ownerCsrfSnapshot = ownerCsrf;
    await api(other, 'post', '/auth/signup')
      .send({
        displayName: 'Other Owner',
        email: `${slug}-other@stockpilot.test`,
        password: 'DemoPass123!',
      })
      .expect(201)
      .then((response) => {
        ownerCsrf = response.body.csrfToken;
      });
    await api(other, 'post', '/organizations')
      .send({ name: `${slug}-other` })
      .expect(201);
    ownerCsrf = ownerCsrfSnapshot;

    const response = await other.get('/v1/analytics').expect(200);
    expect(response.body.ordersByStatus).toEqual([]);
    expect(response.body.fulfilledOrderCount).toBe(0);
    expect(response.body.fulfilledOrderValue).toBe('0.00');
    expect(response.body.topFulfilledProducts).toEqual([]);
  });
});
