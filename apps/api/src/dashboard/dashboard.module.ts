import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  controllers: [DashboardController],
  imports: [BillingModule, DatabaseModule],
  providers: [DashboardService],
})
export class DashboardModule {}
