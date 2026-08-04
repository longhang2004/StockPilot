import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { DemoResetService } from './demo-reset.service.js';

const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/);

@ApiTags('organization')
@Controller('organization')
export class DemoResetController {
  constructor(
    @Inject(DemoResetService) private readonly demo: DemoResetService,
  ) {}

  @RequirePermission('organization:reset-demo')
  @Post('demo-reset')
  @HttpCode(200)
  reset(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.demo.reset(
      request.auth,
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }
}
