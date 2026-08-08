import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlanSchema } from '@stockpilot/contracts';
import { z } from 'zod';

import { CsrfExempt } from '../auth/csrf-exempt.decorator.js';
import { Public } from '../auth/public.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth-context.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { BillingService } from './billing.service.js';

const CheckoutSchema = z.object({ plan: PlanSchema });

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billing: BillingService,
  ) {}

  @RequirePermission('billing:read')
  @Get('billing')
  status(@Req() request: AuthenticatedRequest) {
    return this.billing.status(request.auth);
  }

  @RequirePermission('billing:write')
  @Post('billing/checkout')
  @HttpCode(200)
  checkout(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const { plan } = CheckoutSchema.parse(body);
    return this.billing.createCheckoutSession(request.auth, plan);
  }

  @RequirePermission('billing:write')
  @Post('billing/portal')
  @HttpCode(200)
  portal(@Req() request: AuthenticatedRequest) {
    return this.billing.createPortalSession(request.auth);
  }

  /**
   * Public, CSRF-exempt: Stripe signs the exact payload it delivers, kept
   * untouched in `request.rawBody` by Nest's rawBody option.
   */
  @Public()
  @CsrfExempt()
  @Post('webhooks/stripe')
  @HttpCode(200)
  webhook(@Req() request: RawBodyRequest<AuthenticatedRequest>) {
    const signature = request.get('stripe-signature');
    return this.billing.handleWebhook(
      request.rawBody ?? Buffer.alloc(0),
      signature,
    );
  }
}
