import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  InventoryAdjustmentInputSchema,
  ReceiptInputSchema,
} from '@stockpilot/contracts';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { InventoryService } from './inventory.service.js';

const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/);
const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const AlertQuerySchema = ListQuerySchema.extend({
  status: z.enum(['OPEN', 'RESOLVED']).default('OPEN'),
});

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @RequirePermission('inventory:read')
  @Get('balances')
  balances(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.inventory.listBalances(
      request.auth,
      ListQuerySchema.parse(query),
    );
  }

  @RequirePermission('inventory:read')
  @Get('movements')
  movements(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.inventory.listMovements(
      request.auth,
      ListQuerySchema.parse(query),
    );
  }

  @RequirePermission('inventory:adjust')
  @Post('adjustments')
  adjust(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.inventory.adjust(
      request.auth,
      InventoryAdjustmentInputSchema.parse(body),
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }
}

@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @RequirePermission('inventory:receive')
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.inventory.applyReceipt(
      request.auth,
      ReceiptInputSchema.parse(body),
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }
}

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @RequirePermission('inventory:read')
  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.inventory.listAlerts(
      request.auth,
      AlertQuerySchema.parse(query),
    );
  }
}
