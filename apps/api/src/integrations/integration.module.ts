import { Module } from '@nestjs/common';

import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { IntegrationController } from './integration.controller.js';
import { IntegrationService } from './integration.service.js';

@Module({
  controllers: [IntegrationController],
  imports: [DatabaseModule, EnvironmentModule],
  providers: [IntegrationService],
})
export class IntegrationModule {}
