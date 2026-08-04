import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  controllers: [DashboardController],
  imports: [DatabaseModule],
  providers: [DashboardService],
})
export class DashboardModule {}
