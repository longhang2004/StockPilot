import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import {
  CustomerInputSchema,
  ProductInputSchema,
  SupplierInputSchema,
} from '@stockpilot/contracts';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ProductImportService } from '../imports/product-import.service.js';
import { CatalogService } from './catalog.service.js';
import { PRODUCT_IMAGE_MAX_BYTES } from './product-image-storage.js';
import {
  ProductImageService,
  type ProductImageUpload,
} from './product-image.service.js';

const IdentifierSchema = z.uuid();
const ListQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional().default(''),
});
const ProductUpdateSchema = ProductInputSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'No changes supplied.');
const PartnerUpdateSchema = CustomerInputSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'No changes supplied.');

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(ProductImportService)
    private readonly imports: ProductImportService,
    @Inject(ProductImageService)
    private readonly images: ProductImageService,
  ) {}

  @RequirePermission('catalog:read')
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  export(@Req() request: AuthenticatedRequest) {
    return this.imports.exportProducts(request.auth);
  }

  @RequirePermission('catalog:read')
  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.catalog.listProducts(
      request.auth,
      ListQuerySchema.parse(query),
    );
  }

  @RequirePermission('catalog:read')
  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalog.getProduct(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('catalog:write')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalog.createProduct(
      request.auth,
      ProductInputSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateProduct(
      request.auth,
      IdentifierSchema.parse(id),
      ProductUpdateSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: 1 },
      // MIME headers are intentionally not trusted. The image service checks
      // magic bytes and then decodes the payload with Sharp.
      fileFilter: (_request, _file, callback) => callback(null, true),
    }),
  )
  uploadImage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: ProductImageUpload | undefined,
  ) {
    return this.images.uploadProductImage(
      request.auth,
      IdentifierSchema.parse(id),
      file,
    );
  }

  @RequirePermission('catalog:write')
  @Delete(':id/image')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteImage(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.images.deleteProductImage(
      request.auth,
      IdentifierSchema.parse(id),
    );
  }
}

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @RequirePermission('catalog:read')
  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.catalog.listCustomers(
      request.auth,
      ListQuerySchema.parse(query),
    );
  }

  @RequirePermission('catalog:read')
  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalog.getCustomer(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('catalog:write')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalog.createCustomer(
      request.auth,
      CustomerInputSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateCustomer(
      request.auth,
      IdentifierSchema.parse(id),
      PartnerUpdateSchema.parse(body),
    );
  }
}

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @RequirePermission('catalog:read')
  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.catalog.listSuppliers(
      request.auth,
      ListQuerySchema.parse(query),
    );
  }

  @RequirePermission('catalog:read')
  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalog.getSupplier(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('catalog:write')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalog.createSupplier(
      request.auth,
      SupplierInputSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.catalog.updateSupplier(
      request.auth,
      IdentifierSchema.parse(id),
      PartnerUpdateSchema.parse(body),
    );
  }
}
