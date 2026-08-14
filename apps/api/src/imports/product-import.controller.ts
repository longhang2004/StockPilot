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
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { IDEMPOTENCY_KEY_HEADER, schemaRef } from '../openapi/schemas.js';
import {
  IdentifierSchema,
  IdempotencyKeySchema,
  ImportPreviewInputSchema,
} from './import-schemas.js';
import { ProductImportService } from './product-import.service.js';
import {
  SessionAuth,
  SessionAuthWrite,
} from '../openapi/security.decorator.js';

@ApiTags('product-imports')
@Controller('product-imports')
@SessionAuth()
export class ProductImportController {
  constructor(
    @Inject(ProductImportService)
    private readonly imports: ProductImportService,
  ) {}

  @RequirePermission('catalog:write')
  @Post('preview')
  @SessionAuthWrite()
  @ApiOperation({
    summary: 'Preview a product CSV import',
    description:
      'Parses the CSV client-side-style payload and returns row-level validation results without mutating data.',
  })
  @ApiCreatedResponse({
    description: 'Import preview with row-level results.',
    schema: schemaRef('ImportPreviewResult'),
  })
  @ApiBody({ schema: schemaRef('ImportPreviewInput') })
  preview(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.imports.preview(
      request.auth,
      ImportPreviewInputSchema.parse(body),
    );
  }

  @RequirePermission('catalog:write')
  @Post(':id/commit')
  @SessionAuthWrite()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Commit a validated import',
    description:
      'Creates/updates the valid rows from a previously previewed import in one transaction; invalid rows are skipped.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiOkResponse({
    description: 'Rows created and updated.',
    schema: schemaRef('ImportCommitResult'),
  })
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
