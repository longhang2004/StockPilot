import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import {
  AlertsController,
  InventoryController,
  ReceiptsController,
} from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { InventoryReconciliationService } from './inventory-reconciliation.service.js';

@Module({
  controllers: [InventoryController, ReceiptsController, AlertsController],
  exports: [InventoryReconciliationService],
  imports: [DatabaseModule, JobsModule],
  providers: [InventoryService, InventoryReconciliationService],
})
export class InventoryModule {}
