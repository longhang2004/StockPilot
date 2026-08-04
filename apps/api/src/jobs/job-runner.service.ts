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

export interface IntegrationRetryJob {
  actorUserId: string;
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

  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}

  async onModuleInit(): Promise<void> {
    if (!this.environment.QUEUE_DATABASE_URL) return;
    this.boss = new PgBoss(this.environment.QUEUE_DATABASE_URL);
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

  async enqueueIntegrationRetry(job: IntegrationRetryJob): Promise<void> {
    if (!this.boss) return;
    await this.boss.send(INTEGRATION_RETRY_QUEUE, job, {
      singletonKey: `${job.organizationId}:${job.deliveryId}`,
    });
  }

  queueStatus(): 'ready' | 'not_configured' {
    return this.boss ? 'ready' : 'not_configured';
  }
}
