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

export interface IntegrationRetryJob {
  actorUserId: string;
  deliveryId: string;
  organizationId: string;
}

type IntegrationRetryHandler = (job: IntegrationRetryJob) => Promise<void>;

@Injectable()
export class JobRunnerService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(JobRunnerService.name);
  private boss: PgBoss | null = null;
  private handler: IntegrationRetryHandler | null = null;

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
    this.logger.log('pg-boss integration retry worker started.');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) await this.boss.stop();
  }

  registerIntegrationRetryHandler(handler: IntegrationRetryHandler): void {
    this.handler = handler;
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
