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
import { ApiTags } from '@nestjs/swagger';
import { SalesOrderInputSchema } from '@stockpilot/contracts';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { OrdersService } from './orders.service.js';

const IdentifierSchema = z.uuid();
const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/);
const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional().default(''),
  status: z.enum(['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED']).optional(),
});

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @RequirePermission('order:read')
  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.orders.list(request.auth, ListQuerySchema.parse(query));
  }

  @RequirePermission('order:read')
  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.orders.get(request.auth, IdentifierSchema.parse(id));
  }

  @RequirePermission('order:draft:write')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.orders.create(request.auth, SalesOrderInputSchema.parse(body));
  }

  @RequirePermission('order:draft:write')
  @Patch(':id')
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
  @HttpCode(200)
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
  @HttpCode(200)
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
  @HttpCode(200)
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
