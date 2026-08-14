import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { SessionAuth } from '../openapi/security.decorator.js';
import { AuditService } from './audit.service.js';

const QuerySchema = z.object({
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
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.audit.list(request.auth, QuerySchema.parse(query));
  }
}
