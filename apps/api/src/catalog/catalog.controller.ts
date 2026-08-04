import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
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
