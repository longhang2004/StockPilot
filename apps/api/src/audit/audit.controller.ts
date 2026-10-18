import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { SessionAuth } from '../openapi/security.decorator.js';
import { IdentifierSchema } from '../validation/common-schemas.js';
import { AuditService } from './audit.service.js';

const QuerySchema = z.object({
  entityId: IdentifierSchema.optional(),
  entityType: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

@ApiTags('audit')
@SessionAuth()
@Controller('audit-events')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @RequirePermission('audit:read')
  @Get()
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({
    name: 'entityId',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.audit.list(request.auth, QuerySchema.parse(query));
  }
}
