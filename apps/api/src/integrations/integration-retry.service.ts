import type { TenantDatabase } from '../database/tenant-database.js';
import type {
  JobRunnerService,
  IntegrationRetryJob,
} from '../jobs/job-runner.service.js';
import { retryDeliveryTransaction } from './integration-delivery.service.js';

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
      ),
  );
  if (result.status === 'FAILED') {
    throw new Error(result.error ?? 'Integration retry failed.');
  }
}

export function registerIntegrationRetry(
  jobs: JobRunnerService,
  database: TenantDatabase,
) {
  jobs.registerIntegrationRetryHandler((job) =>
    retryQueuedDelivery(database, job),
  );
}
