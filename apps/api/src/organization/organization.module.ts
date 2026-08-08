import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationController } from './organization.controller.js';
import { OrganizationService } from './organization.service.js';

@Module({
  controllers: [OrganizationController],
  imports: [AuthModule, DatabaseModule, EnvironmentModule],
  providers: [OrganizationService],
})
export class OrganizationModule {}
