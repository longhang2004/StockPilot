import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
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
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SalesOrderInputSchema } from '@stockpilot/contracts';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { IDEMPOTENCY_KEY_HEADER, schemaRef } from '../openapi/schemas.js';
import {
  SessionAuth,
  SessionAuthWrite,
} from '../openapi/security.decorator.js';
import {
  IdentifierSchema,
  IdempotencyKeySchema,
  OrderListQuerySchema,
} from './orders-schemas.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@SessionAuth()
@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @RequirePermission('order:read')
  @Get()
  @ApiOperation({
    summary: 'List sales orders',
    description:
      'Paginated, searchable order list. Ordering is newest first by default.',
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
  @ApiQuery({
    name: 'status',
    required: false,
    schema: {
      type: 'string',
      enum: ['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED'],
    },
  })
  @ApiOkResponse({
    description: 'Paginated order list.',
    schema: schemaRef('OrderList'),
  })
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.orders.list(request.auth, OrderListQuerySchema.parse(query));
  }

  @RequirePermission('order:read')
  @Get(':id')
  @ApiOperation({
    summary: 'Get a sales order',
    description: 'Order detail with lines and transition history.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description: 'Order detail with lines and transitions.',
    schema: schemaRef('SalesOrderDetail'),
  })
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.orders.get(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('order:draft:write')
  @Post()
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Create a draft order' })
  @ApiCreatedResponse({
    description: 'The created draft order with lines.',
    schema: schemaRef('SalesOrderDetail'),
  })
  @ApiBody({ schema: schemaRef('SalesOrderInput') })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.orders.create(request.auth, SalesOrderInputSchema.parse(body));
  }

  @RequirePermission('order:draft:write')
  @Patch(':id')
  @SessionAuthWrite()
  @ApiOperation({ summary: 'Update a draft order' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description: 'The updated draft order with lines.',
    schema: schemaRef('SalesOrderDetail'),
  })
  @ApiBody({ schema: schemaRef('SalesOrderInput') })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.orders.updateDraft(
      request.auth,
      IdentifierSchema.parse(id),
      SalesOrderInputSchema.parse(body),
    );
  }

  @RequirePermission('order:confirm')
  @Post(':id/confirm')
  @SessionAuthWrite()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm a draft order',
    description:
      'Reserves stock atomically with sorted balance-row locks; rejects overselling with 409.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiOkResponse({
    description: 'The confirmed order with lines and transitions.',
    schema: schemaRef('SalesOrderDetail'),
  })
  confirm(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.orders.transition(
      request.auth,
      IdentifierSchema.parse(id),
      'CONFIRMED',
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }

  @RequirePermission('order:fulfill')
  @Post(':id/fulfill')
  @SessionAuthWrite()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Fulfill a confirmed order',
    description:
      'Applies SALE movements and updates on_hand/reserved atomically in one transaction.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiOkResponse({
    description: 'The fulfilled order with lines and transitions.',
    schema: schemaRef('SalesOrderDetail'),
  })
  fulfill(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.orders.transition(
      request.auth,
      IdentifierSchema.parse(id),
      'FULFILLED',
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }

  @RequirePermission('order:cancel')
  @Post(':id/cancel')
  @SessionAuthWrite()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Releases reserved stock for confirmed orders in the same transaction.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiOkResponse({
    description: 'The cancelled order with lines and transitions.',
    schema: schemaRef('SalesOrderDetail'),
  })
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.orders.transition(
      request.auth,
      IdentifierSchema.parse(id),
      'CANCELLED',
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }
}
