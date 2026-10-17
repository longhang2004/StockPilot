import type { TenantDatabase } from '../database/tenant-database.js';
import type {
  JobRunnerService,
  IntegrationRetryJob,
} from '../jobs/job-runner.service.js';
import { retryDeliveryTransaction } from './integration-delivery.service.js';
import type { PrismaService } from '../database/prisma.service.js';

// Initial webhook attempt, one queued attempt, and five pg-boss retries.
export const MAX_AUTOMATIC_DELIVERY_ATTEMPTS = 7;

export async function retryQueuedDelivery(
  database: TenantDatabase,
  job: IntegrationRetryJob,
): Promise<void> {
  const result = await database.withTenant(
    { actorId: job.actorUserId, organizationId: job.organizationId },
    (transaction) =>
      retryDeliveryTransaction(
        transaction,
        job.organizationId,
        job.actorUserId,
        job.deliveryId,
        MAX_AUTOMATIC_DELIVERY_ATTEMPTS,
      ),
  );
  if (result.status === 'FAILED') {
    throw new Error(result.error ?? 'Integration retry failed.');
  }
}

export async function recoverFailedDeliveries(
  jobs: JobRunnerService,
  database: TenantDatabase,
  prisma: PrismaService,
): Promise<void> {
  const organizations = await prisma.organization.findMany({
    include: {
      memberships: {
        select: { userId: true },
        where: { role: 'OWNER' },
        take: 1,
      },
    },
    orderBy: { id: 'asc' },
  });
  for (const organization of organizations) {
    const owner = organization.memberships[0];
    if (!owner) continue;
    let cursor: string | undefined;
    while (true) {
      const deliveries = await database.withTenant(
        { actorId: owner.userId, organizationId: organization.id },
        (transaction) =>
          transaction.integrationDelivery.findMany({
            select: { id: true },
            where: {
              organizationId: organization.id,
              status: 'FAILED',
              attempts: { lt: MAX_AUTOMATIC_DELIVERY_ATTEMPTS },
              ...(cursor ? { id: { gt: cursor } } : {}),
            },
            orderBy: { id: 'asc' },
            take: 100,
          }),
      );
      for (const delivery of deliveries) {
        const job = {
          actorUserId: owner.userId,
          deliveryId: delivery.id,
          organizationId: organization.id,
        };
        if (!(await jobs.hasPendingIntegrationRetry(job))) {
          await jobs.enqueueIntegrationRetry(job);
        }
      }
      if (deliveries.length < 100) break;
      cursor = deliveries.at(-1)!.id;
    }
  }
}

export function registerIntegrationRetry(
  jobs: JobRunnerService,
  database: TenantDatabase,
  prisma: PrismaService,
) {
  jobs.registerIntegrationRetryHandler((job) =>
    retryQueuedDelivery(database, job),
  );
  jobs.registerIntegrationRecoveryHandler(() =>
    recoverFailedDeliveries(jobs, database, prisma),
  );
}
