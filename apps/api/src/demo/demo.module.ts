import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { DemoResetController } from './demo-reset.controller.js';
import { DemoResetService } from './demo-reset.service.js';

@Module({
  controllers: [DemoResetController],
  exports: [DemoResetService],
  imports: [DatabaseModule],
  providers: [DemoResetService],
})
export class DemoModule {}
