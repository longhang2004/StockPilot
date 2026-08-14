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
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CustomerInputSchema,
  ProductInputSchema,
  SupplierInputSchema,
} from '@stockpilot/contracts';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ProductImportService } from '../imports/product-import.service.js';
import { schemaRef } from '../openapi/schemas.js';
import {
  CatalogListQuerySchema,
  IdentifierSchema,
  PartnerUpdateSchema,
  ProductUpdateSchema,
} from './catalog-schemas.js';
import { CatalogService } from './catalog.service.js';
import { PRODUCT_IMAGE_MAX_BYTES } from './product-image-storage.js';
import {
  ProductImageService,
  type ProductImageUpload,
} from './product-image.service.js';
import {
  SessionAuth,
  SessionAuthWrite,
} from '../openapi/security.decorator.js';

@ApiTags('products')
@Controller('products')
@SessionAuth()
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
  @ApiOperation({
    summary: 'List products',
    description: 'Paginated, searchable product catalog.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    schema: {
      type: 'string',
      enum: ['true', 'false'],
      description: 'Include inactive products (default false).',
    },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiQuery({
    name: 'search',
    required: false,
    schema: { type: 'string', maxLength: 160 },
  })
  @ApiOkResponse({
    description: 'Paginated product list.',
    schema: schemaRef('ProductList'),
  })
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.catalog.listProducts(
      request.auth,
      CatalogListQuerySchema.parse(query),
    );
  }

  @RequirePermission('catalog:read')
  @Get(':id')
  @ApiOperation({ summary: 'Get a product' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'The product.', schema: schemaRef('Product') })
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalog.getProduct(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('catalog:write')
  @Post()
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Create a product' })
  @ApiCreatedResponse({
    description: 'The created product.',
    schema: schemaRef('Product'),
  })
  @ApiBody({ schema: schemaRef('ProductInput') })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalog.createProduct(
      request.auth,
      ProductInputSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Patch(':id')
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description: 'The updated product.',
    schema: schemaRef('Product'),
  })
  @ApiBody({ schema: schemaRef('ProductUpdateInput') })
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
  @SessionAuthWrite()
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
  @SessionAuthWrite()
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
@SessionAuth()
export class CustomersController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @RequirePermission('catalog:read')
  @Get()
  @ApiOperation({
    summary: 'List customers',
    description: 'Paginated, searchable customer list.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiQuery({
    name: 'search',
    required: false,
    schema: { type: 'string', maxLength: 160 },
  })
  @ApiOkResponse({
    description: 'Paginated customer list.',
    schema: schemaRef('CustomerList'),
  })
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.catalog.listCustomers(
      request.auth,
      CatalogListQuerySchema.parse(query),
    );
  }

  @RequirePermission('catalog:read')
  @Get(':id')
  @ApiOperation({ summary: 'Get a customer' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description: 'The customer.',
    schema: schemaRef('Customer'),
  })
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalog.getCustomer(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('catalog:write')
  @Post()
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Create a customer' })
  @ApiCreatedResponse({
    description: 'The created customer.',
    schema: schemaRef('Customer'),
  })
  @ApiBody({ schema: schemaRef('CustomerInput') })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalog.createCustomer(
      request.auth,
      CustomerInputSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Patch(':id')
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description: 'The updated customer.',
    schema: schemaRef('Customer'),
  })
  @ApiBody({ schema: schemaRef('CustomerUpdateInput') })
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
@SessionAuth()
export class SuppliersController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @RequirePermission('catalog:read')
  @Get()
  @ApiOperation({
    summary: 'List suppliers',
    description: 'Paginated, searchable supplier list.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiQuery({
    name: 'search',
    required: false,
    schema: { type: 'string', maxLength: 160 },
  })
  @ApiOkResponse({
    description: 'Paginated supplier list.',
    schema: schemaRef('SupplierList'),
  })
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.catalog.listSuppliers(
      request.auth,
      CatalogListQuerySchema.parse(query),
    );
  }

  @RequirePermission('catalog:read')
  @Get(':id')
  @ApiOperation({ summary: 'Get a supplier' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description: 'The supplier.',
    schema: schemaRef('Supplier'),
  })
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalog.getSupplier(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('catalog:write')
  @Post()
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Create a supplier' })
  @ApiCreatedResponse({
    description: 'The created supplier.',
    schema: schemaRef('Supplier'),
  })
  @ApiBody({ schema: schemaRef('SupplierInput') })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalog.createSupplier(
      request.auth,
      SupplierInputSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Patch(':id')
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description: 'The updated supplier.',
    schema: schemaRef('Supplier'),
  })
  @ApiBody({ schema: schemaRef('SupplierUpdateInput') })
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
