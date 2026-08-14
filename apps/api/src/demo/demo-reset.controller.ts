import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { DemoResetService } from './demo-reset.service.js';
import { IDEMPOTENCY_KEY_HEADER } from '../openapi/schemas.js';
import {
  SessionAuth,
  SessionAuthWrite,
} from '../openapi/security.decorator.js';
import { IdempotencyKeySchema } from '../validation/common-schemas.js';

@ApiTags('organization')
@Controller('organization')
@SessionAuth()
export class DemoResetController {
  constructor(
    @Inject(DemoResetService) private readonly demo: DemoResetService,
  ) {}

  @RequirePermission('organization:reset-demo')
  @Post('demo-reset')
  @ApiOperation({
    summary: 'Reset demo data',
    description:
      'Deletes and reseeds the canonical demo fixture in one tenant transaction. Idempotent: reusing an Idempotency-Key replays the original response.',
  })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @SessionAuthWrite()
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
