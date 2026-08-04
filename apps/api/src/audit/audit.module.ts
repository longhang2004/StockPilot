import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  controllers: [AuditController],
  imports: [DatabaseModule],
  providers: [AuditService],
})
export class AuditModule {}
