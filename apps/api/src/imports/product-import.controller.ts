import {
  Body,
  Controller,
  Get,
  Headers,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ProductImportService } from './product-import.service.js';

const IdentifierSchema = z.uuid();
const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/);
const PreviewInputSchema = z.object({
  content: z.string(),
  fileName: z.string().trim().min(1).max(255),
});

@ApiTags('product-imports')
@Controller('product-imports')
export class ProductImportController {
  constructor(
    @Inject(ProductImportService)
    private readonly imports: ProductImportService,
  ) {}

  @RequirePermission('catalog:write')
  @Post('preview')
  preview(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.imports.preview(request.auth, PreviewInputSchema.parse(body));
  }

  @RequirePermission('catalog:write')
  @Post(':id/commit')
  @HttpCode(200)
  commit(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.imports.commit(
      request.auth,
      IdentifierSchema.parse(id),
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }

  @RequirePermission('catalog:read')
  @Get(':id/errors.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="product-import-errors.csv"',
  )
  errors(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.imports.errorsCsv(request.auth, IdentifierSchema.parse(id));
  }
}
