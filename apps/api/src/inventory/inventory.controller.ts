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
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  InventoryAdjustmentInputSchema,
  ReceiptInputSchema,
} from '@stockpilot/contracts';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { IDEMPOTENCY_KEY_HEADER, schemaRef } from '../openapi/schemas.js';
import {
  AlertListQuerySchema,
  IdempotencyKeySchema,
  InventoryListQuerySchema,
} from './inventory-schemas.js';
import { InventoryService } from './inventory.service.js';
import {
  SessionAuth,
  SessionAuthWrite,
} from '../openapi/security.decorator.js';

@ApiTags('inventory')
@Controller('inventory')
@SessionAuth()
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @RequirePermission('inventory:read')
  @Get('balances')
  @ApiOperation({ summary: 'List inventory balances' })
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
  @ApiOkResponse({
    description: 'Paginated balance list.',
    schema: schemaRef('InventoryBalanceList'),
  })
  balances(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.inventory.listBalances(
      request.auth,
      InventoryListQuerySchema.parse(query),
    );
  }

  @RequirePermission('inventory:read')
  @Get('movements')
  @ApiOperation({
    summary: 'List stock movements',
    description: 'Append-only movement ledger, newest first.',
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
  @ApiOkResponse({
    description: 'Paginated movement list.',
    schema: schemaRef('StockMovementList'),
  })
  movements(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.inventory.listMovements(
      request.auth,
      InventoryListQuerySchema.parse(query),
    );
  }

  @RequirePermission('inventory:adjust')
  @Post('adjustments')
  @SessionAuthWrite()
  @ApiOperation({
    summary: 'Apply a stock adjustment',
    description:
      'Appends an ADJUSTMENT_IN/ADJUSTMENT_OUT movement and updates the balance in one transaction.',
  })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiCreatedResponse({
    description: 'The resulting balance and appended movement.',
    schema: schemaRef('AdjustmentResult'),
  })
  @ApiBody({ schema: schemaRef('InventoryAdjustmentInput') })
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
@SessionAuth()
export class ReceiptsController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @RequirePermission('inventory:receive')
  @Post()
  @SessionAuthWrite()
  @ApiOperation({
    summary: 'Apply a goods receipt',
    description:
      'Appends RECEIPT movements and updates balances atomically in one transaction. A product may appear only once per receipt.',
  })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiCreatedResponse({
    description: 'The receipt with resulting balances and lines.',
    schema: schemaRef('ReceiptResult'),
  })
  @ApiBody({ schema: schemaRef('ReceiptInput') })
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
@SessionAuth()
export class AlertsController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @RequirePermission('inventory:read')
  @Get()
  @ApiOperation({ summary: 'List low-stock alerts' })
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
    name: 'status',
    required: false,
    schema: { type: 'string', enum: ['OPEN', 'RESOLVED'], default: 'OPEN' },
  })
  @ApiOkResponse({
    description: 'Paginated low-stock alert list.',
    schema: schemaRef('LowStockAlertList'),
  })
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.inventory.listAlerts(
      request.auth,
      AlertListQuerySchema.parse(query),
    );
  }
}
