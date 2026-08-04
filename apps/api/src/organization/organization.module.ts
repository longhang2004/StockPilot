import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { OrganizationController } from './organization.controller.js';
import { OrganizationService } from './organization.service.js';

@Module({
  controllers: [OrganizationController],
  imports: [DatabaseModule],
  providers: [OrganizationService],
})
export class OrganizationModule {}
