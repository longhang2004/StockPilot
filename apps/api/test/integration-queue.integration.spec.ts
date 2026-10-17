import { createHmac, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  JobRunnerService,
  INTEGRATION_RETRY_QUEUE,
  INTEGRATION_DEAD_LETTER_QUEUE,
  INTEGRATION_RECOVERY_QUEUE,
  INVENTORY_RECONCILE_QUEUE,
} from '../src/jobs/job-runner.service.js';
import { TenantDatabase } from '../src/database/tenant-database.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { recoverFailedDeliveries } from '../src/integrations/integration-retry.service.js';
import { createTestAgent, demoLogin } from './support/agent.js';
import {
  adminDatabaseUrl,
  appDatabaseUrl,
  setTestEnvironment,
  TEST_WEB_ORIGIN,
} from './support/environment.js';
import {
  createAdminClient,
  createTestApplication,
} from './support/test-app.js';

// Opt in with a pg-boss-capable database role. The normal application role
// deliberately cannot create queue schemas or bypass tenant RLS.
describe.skipIf(!process.env.QUEUE_TEST_DATABASE_URL)(
  'real pg-boss delivery processing',
  () => {
    const slug = `queue-test-${randomUUID()}`;
    const secret = 'queue-integration-webhook-secret';
    const applicationName = `queue-${randomUUID()}`;
    let app: INestApplication;
    let admin: Awaited<ReturnType<typeof createAdminClient>>;
    let manager: ReturnType<typeof createTestAgent>;
    let csrf: string;
    let organizationId: string;
    let actorUserId: string;
    let inspector: PgBoss;

    async function connectManager() {
      manager = createTestAgent(app);
      ({ csrfToken: csrf } = await demoLogin(manager, 'MANAGER'));
    }

    async function waitForCondition(
      condition: () => Promise<boolean>,
      timeoutMs: number,
      intervalMs: number,
    ) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await condition()) return;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      throw new Error('Timed out waiting for scheduled work to settle.');
    }

    async function isolateScheduledWork() {
      // Exercise startup recovery but keep wall-clock cron ticks from racing
      // the explicit enqueue-loss and concurrency barriers below.
      await inspector.unschedule(
        INTEGRATION_RECOVERY_QUEUE,
        'stockpilot-integration-recovery',
      );
      await inspector.unschedule(
        INVENTORY_RECONCILE_QUEUE,
        'stockpilot-inventory-reconcile',
      );
      await waitForCondition(
        async () => {
          const jobs = await inspector.findJobs(INTEGRATION_RECOVERY_QUEUE, {});
          return jobs.every((job) =>
            ['completed', 'failed', 'cancelled'].includes(job.state),
          );
        },
        10000,
        100,
      );
    }

    async function failedDelivery() {
      const sku = `QUEUE-${randomUUID()}`;
      const externalDeliveryId = `external-${randomUUID()}`;
      const externalOrderId = `order-${randomUUID()}`;
      const payload = {
        customer: { companyName: 'Queue Test Market' },
        eventType: 'order.created',
        externalOrderId,
        items: [{ quantity: 1, sku }],
      };
      let queued: unknown;
      const enqueue = vi
        .spyOn(app.get(JobRunnerService), 'enqueueIntegrationRetry')
        .mockImplementationOnce(async (job) => {
          queued = job;
          throw new Error('Simulated enqueue outage after commit');
        });
      try {
        const result = await request(app.getHttpServer())
          .post('/v1/webhooks/mock-storefront/orders')
          .set('X-Delivery-Id', externalDeliveryId)
          .set('X-Organization-Slug', slug)
          .set(
            'X-Storefront-Signature',
            createHmac('sha256', secret)
              .update(JSON.stringify(payload))
              .digest('hex'),
          )
          .send(payload);
        expect(result.status).toBe(202);
        expect(result.body.status).toBe('FAILED');
      } finally {
        enqueue.mockRestore();
      }
      const delivery = await admin.integrationDelivery.findUniqueOrThrow({
        where: {
          organizationId_externalDeliveryId: {
            organizationId,
            externalDeliveryId,
          },
        },
      });
      expect(queued).toEqual({
        actorUserId,
        deliveryId: delivery.id,
        organizationId,
      });
      return { delivery, externalOrderId, sku };
    }

    async function createProduct(sku: string) {
      const result = await manager
        .post('/v1/products')
        .set('Origin', TEST_WEB_ORIGIN)
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'Queue Test Product',
          reorderPoint: 0,
          salePrice: '10.00',
          sku,
        });
      expect(result.status).toBe(201);
    }

    async function deliveryStatus(id: string) {
      return (
        await admin.integrationDelivery.findUniqueOrThrow({ where: { id } })
      ).status;
    }

    // The first real pg-boss run creates its schema and queue metadata in a
    // separate database; allow that initialization to finish on cold CI hosts.
    beforeAll(async () => {
      setTestEnvironment({
        DEMO_ORGANIZATION_SLUG: slug,
        WEBHOOK_SIGNING_SECRET: secret,
        QUEUE_DATABASE_URL: process.env.QUEUE_TEST_DATABASE_URL!,
        DATABASE_URL: `${appDatabaseUrl()}${appDatabaseUrl().includes('?') ? '&' : '?'}application_name=${applicationName}`,
      });
      admin = await createAdminClient(adminDatabaseUrl());
      const { seedDemoIdentity } = await import('../prisma/seed.js');
      await seedDemoIdentity(admin, { seedFixture: false, slug });
      const organization = await admin.organization.findUniqueOrThrow({
        include: { memberships: { where: { role: 'OWNER' } } },
        where: { slug },
      });
      organizationId = organization.id;
      actorUserId = organization.memberships[0]!.userId;
      inspector = new PgBoss({
        connectionString: process.env.QUEUE_TEST_DATABASE_URL!,
        supervise: false,
        schedule: false,
      });
      await inspector.start();
      ({ app } = await createTestApplication());
      await connectManager();
      await isolateScheduledWork();
    }, 120_000);

    afterAll(async () => {
      await app?.close();
      if (inspector) {
        for (const queue of [
          INTEGRATION_RETRY_QUEUE,
          INTEGRATION_DEAD_LETTER_QUEUE,
        ]) {
          const jobs = await inspector.findJobs(queue, {
            data: { organizationId },
          });
          if (jobs.length)
            await inspector.deleteJob(
              queue,
              jobs.map((job) => job.id),
            );
        }
      }
      await inspector?.stop();
      if (admin) {
        await admin.organization.deleteMany({ where: { slug } });
        await admin.user.deleteMany({
          where: { email: { endsWith: `@${slug}.stockpilot.test` } },
        });
        await admin.$disconnect();
      }
    }, 120_000);

    it('recovers a committed failure after enqueue loss and an application restart', async () => {
      const { delivery, sku } = await failedDelivery();
      await createProduct(sku);
      await app.close();
      ({ app } = await createTestApplication());
      await connectManager();
      await expect
        .poll(() => deliveryStatus(delivery.id), {
          timeout: 15000,
          interval: 100,
        })
        .toBe('SUCCEEDED');
      const updated = await admin.integrationDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      expect(updated.attempts).toBe(2);
      expect(updated.salesOrderId).toBeTruthy();
      await isolateScheduledWork();
    });

    it('does not enqueue a second job while pg-boss is backing off a retry', async () => {
      const { delivery } = await failedDelivery();
      await inspector.send(
        INTEGRATION_RETRY_QUEUE,
        { actorUserId, deliveryId: delivery.id, organizationId },
        { singletonKey: `${organizationId}:${delivery.id}` },
      );
      const key = `${organizationId}:${delivery.id}`;
      await expect
        .poll(
          async () => {
            const jobs = await inspector.findJobs(INTEGRATION_RETRY_QUEUE, {
              key,
            });
            return jobs.find((job) => job.state === 'retry')?.id ?? null;
          },
          { timeout: 10000, interval: 100 },
        )
        .not.toBeNull();
      const before = await inspector.findJobs(INTEGRATION_RETRY_QUEUE, {
        key,
      });
      expect(before.filter((job) => job.state === 'retry')).toHaveLength(1);
      expect(
        (
          await admin.integrationDelivery.findUniqueOrThrow({
            where: { id: delivery.id },
          })
        ).attempts,
      ).toBe(2);

      await recoverFailedDeliveries(
        app.get(JobRunnerService),
        app.get(TenantDatabase),
        app.get(PrismaService),
      );

      const after = await inspector.findJobs(INTEGRATION_RETRY_QUEUE, {
        key,
      });
      expect(after.filter((job) => job.state === 'retry')).toHaveLength(1);
      expect(after.map((job) => job.id)).toEqual(before.map((job) => job.id));
      expect(
        (
          await admin.integrationDelivery.findUniqueOrThrow({
            where: { id: delivery.id },
          })
        ).attempts,
      ).toBe(2);
      await isolateScheduledWork();
    });

    it('serializes a real queue worker with a simultaneous manual retry', async () => {
      const { delivery, externalOrderId, sku } = await failedDelivery();
      await createProduct(sku);
      const blocked = (count: number) =>
        expect
          .poll(
            async () => {
              const rows = await admin.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE application_name = ${applicationName} AND wait_event_type = 'Lock'
      `;
              return rows[0]!.count;
            },
            { timeout: 6000, interval: 30 },
          )
          .toBe(count);

      const pending = await admin.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`
        SELECT id FROM integration_deliveries WHERE id = ${delivery.id}::uuid FOR UPDATE
      `;
          await app.get(JobRunnerService).enqueueIntegrationRetry({
            actorUserId,
            deliveryId: delivery.id,
            organizationId,
          });
          await blocked(1);
          const manual = manager
            .post(`/v1/integration-deliveries/${delivery.id}/retry`)
            .set('Origin', TEST_WEB_ORIGIN)
            .set('X-CSRF-Token', csrf)
            .set('Idempotency-Key', randomUUID())
            .send()
            .then((response) => response);
          await blocked(2);
          return { manual };
        },
        { timeout: 12000 },
      );
      const manual = await pending.manual;
      expect(manual.status).toBe(200);
      expect(manual.body).toMatchObject({
        duplicate: true,
        status: 'SUCCEEDED',
      });
      const updated = await admin.integrationDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      expect(updated.attempts).toBe(2);
      const orders = await manager.get(`/v1/orders?search=${externalOrderId}`);
      expect(orders.body.total).toBe(1);
    });

    it('keeps exhausted failures visible and moves their job into the real dead-letter queue', async () => {
      const { delivery } = await failedDelivery();
      await admin.integrationDelivery.update({
        where: { id: delivery.id },
        data: { attempts: 6 },
      });
      const jobId = await inspector.send(
        INTEGRATION_RETRY_QUEUE,
        {
          actorUserId,
          deliveryId: delivery.id,
          organizationId,
        },
        { retryLimit: 0 },
      );
      expect(jobId).toBeTruthy();
      await expect
        .poll(
          async () =>
            (await inspector.getJobById(INTEGRATION_RETRY_QUEUE, jobId!))
              ?.state,
          { timeout: 10000, interval: 100 },
        )
        .toBe('failed');
      const deadLetters = await inspector.findJobs(
        INTEGRATION_DEAD_LETTER_QUEUE,
        {
          data: { deliveryId: delivery.id },
        },
      );
      expect(deadLetters).toHaveLength(1);
      const updated = await admin.integrationDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      expect(updated).toMatchObject({ attempts: 7, status: 'FAILED' });
      expect(updated.lastError).toContain('Unknown SKU');
      await app.close();
      ({ app } = await createTestApplication());
      await connectManager();
      await isolateScheduledWork();
      const retainedJobs = await inspector.findJobs(INTEGRATION_RETRY_QUEUE, {
        data: { deliveryId: delivery.id },
      });
      expect(retainedJobs).toHaveLength(1);
      expect(
        (
          await admin.integrationDelivery.findUniqueOrThrow({
            where: { id: delivery.id },
          })
        ).attempts,
      ).toBe(7);
    });
  },
);
