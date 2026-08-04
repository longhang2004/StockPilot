import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  imports: [DatabaseModule],
  providers: [OrdersService],
})
export class OrdersModule {}
