import { Module } from '@nestjs/common';

import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProductImportModule } from '../imports/product-import.module.js';
import {
  CustomersController,
  ProductsController,
  SuppliersController,
} from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { CloudinaryImageStorage } from './product-image-storage.js';
import { productImageStorageProvider } from './product-image-storage.provider.js';
import { ProductImageService } from './product-image.service.js';

@Module({
  controllers: [ProductsController, CustomersController, SuppliersController],
  imports: [DatabaseModule, EnvironmentModule, ProductImportModule],
  providers: [
    CatalogService,
    CloudinaryImageStorage,
    productImageStorageProvider,
    ProductImageService,
  ],
})
export class CatalogModule {}
