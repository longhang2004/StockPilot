import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SupplierInputSchema } from '@stockpilot/contracts';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { schemaRef } from '../openapi/schemas.js';
import {
  SessionAuth,
  SessionAuthWrite,
} from '../openapi/security.decorator.js';
import {
  CatalogListQuerySchema,
  IdentifierSchema,
  PartnerUpdateSchema,
} from './catalog-schemas.js';
import { CatalogService } from './catalog.service.js';

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
