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
import { CustomerInputSchema } from '@stockpilot/contracts';

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
