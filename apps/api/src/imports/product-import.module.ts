import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ProductImportController } from './product-import.controller.js';
import { ProductImportService } from './product-import.service.js';

@Module({
  controllers: [ProductImportController],
  exports: [ProductImportService],
  imports: [DatabaseModule],
  providers: [ProductImportService],
})
export class ProductImportModule {}
