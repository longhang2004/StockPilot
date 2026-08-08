import { Module } from '@nestjs/common';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EnvironmentModule } from '../config/environment.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { BillingStatusService } from './billing-status.service.js';
import { StripeClient } from './stripe-client.js';

@Module({
  controllers: [BillingController],
  exports: [BillingStatusService],
  imports: [AuthModule, DatabaseModule, EnvironmentModule],
  providers: [
    BillingService,
    BillingStatusService,
    {
      provide: StripeClient,
      useFactory: (environment: Environment) =>
        new StripeClient(environment.STRIPE_SECRET_KEY ?? ''),
      inject: [ENVIRONMENT],
    },
  ],
})
export class BillingModule {}
