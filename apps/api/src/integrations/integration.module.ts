import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module.js';
import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { IntegrationController } from './integration.controller.js';
import { IntegrationService } from './integration.service.js';

@Module({
  controllers: [IntegrationController],
  imports: [BillingModule, DatabaseModule, EnvironmentModule, JobsModule],
  providers: [IntegrationService],
})
export class IntegrationModule {}
