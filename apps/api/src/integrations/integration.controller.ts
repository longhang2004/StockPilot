import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { CsrfExempt } from '../auth/csrf-exempt.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import {
  IntegrationService,
  MockStorefrontOrderSchema,
} from './integration.service.js';
import { z } from 'zod';

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
  status: z.enum(['RECEIVED', 'PROCESSING', 'SUCCEEDED', 'FAILED']).optional(),
});

@ApiTags('integrations')
@Controller()
export class IntegrationController {
  constructor(
    @Inject(IntegrationService)
    private readonly integrations: IntegrationService,
  ) {}

  @Public()
  @CsrfExempt()
  @Post('webhooks/mock-storefront/orders')
  @HttpCode(202)
  receiveMockStorefrontOrder(
    @Headers('x-delivery-id') deliveryId: string | undefined,
    @Headers('x-organization-slug') organizationSlug: string | undefined,
    @Headers('x-storefront-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const payload = MockStorefrontOrderSchema.parse(body);
    return this.integrations.receiveMockStorefrontOrder(
      {
        deliveryId: z.string().trim().min(1).max(160).parse(deliveryId),
        organizationSlug: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .parse(organizationSlug),
        signature: z.string().min(1).parse(signature),
      },
      payload,
    );
  }

  @RequirePermission('integration:retry')
  @Get('integration-deliveries')
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.integrations.list(request.auth, ListQuerySchema.parse(query));
  }

  @RequirePermission('integration:retry')
  @Post('integration-deliveries/:id/retry')
  @HttpCode(200)
  retry(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.integrations.retry(
      request.auth,
      IdentifierSchema.parse(id),
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }
}
