import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ProductImportModule } from '../imports/product-import.module.js';
import {
  CustomersController,
  ProductsController,
  SuppliersController,
} from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  controllers: [ProductsController, CustomersController, SuppliersController],
  imports: [DatabaseModule, ProductImportModule],
  providers: [CatalogService],
})
export class CatalogModule {}
