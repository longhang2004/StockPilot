import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  controllers: [AnalyticsController],
  imports: [DatabaseModule],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
