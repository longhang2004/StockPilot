import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { InvitationService } from './invitation.service.js';
import { MembershipService } from './membership.service.js';
import { TeamController } from './team.controller.js';

@Module({
  controllers: [TeamController],
  imports: [AuthModule, BillingModule, DatabaseModule, EnvironmentModule],
  providers: [InvitationService, MembershipService],
})
export class TeamModule {}
