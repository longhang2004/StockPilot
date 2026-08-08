import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  controllers: [TeamController],
  imports: [AuthModule, BillingModule, DatabaseModule, EnvironmentModule],
  providers: [TeamService],
})
export class TeamModule {}
