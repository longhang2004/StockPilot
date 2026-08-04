import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import {
  AlertsController,
  InventoryController,
  ReceiptsController,
} from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  controllers: [InventoryController, ReceiptsController, AlertsController],
  imports: [DatabaseModule],
  providers: [InventoryService],
})
export class InventoryModule {}
