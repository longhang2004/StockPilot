import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { BillingModule } from './billing/billing.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DemoModule } from './demo/demo.module.js';
import { HealthController } from './health/health.controller.js';
import { EnvironmentModule } from './config/environment.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { IntegrationModule } from './integrations/integration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { TeamModule } from './team/team.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    EnvironmentModule,
    AuthModule,
    AnalyticsModule,
    AuditModule,
    BillingModule,
    CatalogModule,
    DashboardModule,
    DemoModule,
    InventoryModule,
    IntegrationModule,
    JobsModule,
    OrdersModule,
    OrganizationModule,
    ObservabilityModule,
    TeamModule,
  ],
})
export class AppModule {}
