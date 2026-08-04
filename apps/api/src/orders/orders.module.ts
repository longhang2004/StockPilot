import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  imports: [DatabaseModule, InventoryModule],
  providers: [OrdersService],
})
export class OrdersModule {}
