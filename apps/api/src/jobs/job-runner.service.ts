import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PgBoss, type Job } from 'pg-boss';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';

export const INTEGRATION_RETRY_QUEUE = 'stockpilot.integration.retry';
export const INTEGRATION_DEAD_LETTER_QUEUE =
  'stockpilot.integration.dead-letter';
export const INVENTORY_RECONCILE_QUEUE = 'stockpilot.inventory.reconcile';
export const INTEGRATION_RECOVERY_QUEUE = 'stockpilot.integration.recover';

export interface IntegrationRetryJob {
  actorUserId: string;
  /** Internal IntegrationDelivery.id UUID, never the external webhook ID. */
  deliveryId: string;
  organizationId: string;
}

type IntegrationRetryHandler = (job: IntegrationRetryJob) => Promise<void>;
type InventoryReconcileHandler = () => Promise<void>;

@Injectable()
export class JobRunnerService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(JobRunnerService.name);
  private boss: PgBoss | null = null;
  private handler: IntegrationRetryHandler | null = null;
  private inventoryReconcileHandler: InventoryReconcileHandler | null = null;
  private integrationRecoveryHandler: (() => Promise<void>) | null = null;

  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}

  async onModuleInit(): Promise<void> {
    if (!this.environment.QUEUE_DATABASE_URL) return;
    this.boss = new PgBoss(this.environment.QUEUE_DATABASE_URL);
    this.boss.on('error', (error: Error) => this.logger.error(error.message));
    await this.boss.start();
    await this.boss.createQueue(INTEGRATION_DEAD_LETTER_QUEUE, {
      deleteAfterSeconds: 0,
      retentionSeconds: 30 * 24 * 60 * 60,
    });
    await this.boss.createQueue(INTEGRATION_RETRY_QUEUE, {
      deadLetter: INTEGRATION_DEAD_LETTER_QUEUE,
      deleteAfterSeconds: 7 * 24 * 60 * 60,
      retryBackoff: true,
      retryDelay: 30,
      retryLimit: 5,
    });
    await this.boss.createQueue(INVENTORY_RECONCILE_QUEUE, {
      deadLetter: INTEGRATION_DEAD_LETTER_QUEUE,
      deleteAfterSeconds: 24 * 60 * 60,
      retryBackoff: true,
      retryDelay: 60,
      retryLimit: 5,
    });
    await this.boss.createQueue(INTEGRATION_RECOVERY_QUEUE, {
      policy: 'exclusive',
      deleteAfterSeconds: 24 * 60 * 60,
      retryDelay: 30,
      retryLimit: 5,
    });
    await this.boss.work<IntegrationRetryJob>(
      INTEGRATION_RETRY_QUEUE,
      async (jobs: Job<IntegrationRetryJob>[]) => {
        if (!this.handler) {
          throw new Error('Integration retry handler is not registered.');
        }
        for (const job of jobs) {
          await this.handler(job.data);
        }
      },
    );
    await this.boss.work<Record<string, never>>(
      INVENTORY_RECONCILE_QUEUE,
      async (jobs: Job<Record<string, never>>[]) => {
        if (!this.inventoryReconcileHandler) {
          throw new Error(
            'Inventory reconciliation handler is not registered.',
          );
        }
        for (const _job of jobs) {
          await this.inventoryReconcileHandler();
        }
      },
    );
    await this.boss.schedule(
      INVENTORY_RECONCILE_QUEUE,
      '*/15 * * * *',
      {},
      { key: 'stockpilot-inventory-reconcile' },
    );
    await this.boss.work(INTEGRATION_RECOVERY_QUEUE, async () => {
      if (!this.integrationRecoveryHandler) {
        throw new Error('Integration recovery handler is not registered.');
      }
      await this.integrationRecoveryHandler();
    });
    await this.boss.schedule(
      INTEGRATION_RECOVERY_QUEUE,
      '* * * * *',
      {},
      { key: 'stockpilot-integration-recovery' },
    );
    // Recover deliveries committed before a process/queue failure at enqueue.
    await this.boss.send(INTEGRATION_RECOVERY_QUEUE, {});
    this.logger.log('pg-boss integration retry worker started.');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) await this.boss.stop();
  }

  registerIntegrationRetryHandler(handler: IntegrationRetryHandler): void {
    this.handler = handler;
  }

  registerInventoryReconcileHandler(handler: InventoryReconcileHandler): void {
    this.inventoryReconcileHandler = handler;
  }

  registerIntegrationRecoveryHandler(handler: () => Promise<void>): void {
    this.integrationRecoveryHandler = handler;
  }

  async enqueueIntegrationRetry(job: IntegrationRetryJob): Promise<void> {
    if (!this.boss) return;
    await this.boss.send(INTEGRATION_RETRY_QUEUE, job, {
      singletonKey: `${job.organizationId}:${job.deliveryId}`,
      singletonSeconds: 60,
    });
  }

  async hasPendingIntegrationRetry(job: IntegrationRetryJob): Promise<boolean> {
    if (!this.boss) return false;
    let after: string | undefined;
    while (true) {
      const matches = await this.boss.findJobs(INTEGRATION_RETRY_QUEUE, {
        key: `${job.organizationId}:${job.deliveryId}`,
        limit: 1000,
        ...(after ? { after } : {}),
      });
      if (
        matches.some((match) =>
          ['created', 'retry', 'active'].includes(match.state),
        )
      ) {
        return true;
      }
      if (matches.length < 1000) return false;
      after = matches.at(-1)!.id;
    }
  }

  queueStatus(): 'ready' | 'not_configured' {
    return this.boss ? 'ready' : 'not_configured';
  }
}
