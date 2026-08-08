import { Inject, Injectable } from '@nestjs/common';
import type { OverviewResponse } from '@stockpilot/contracts';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { BillingStatusService } from '../billing/billing-status.service.js';
import { TenantDatabase } from '../database/tenant-database.js';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(BillingStatusService)
    private readonly billingStatus: BillingStatusService,
  ) {}

  async overview(auth: AuthContext): Promise<OverviewResponse> {
    const plan = await this.billingStatus.currentPlan(auth);
    const organizationId = requireMembership(auth).organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const [
          ordersAwaitingApproval,
          openLowStockAlerts,
          failedIntegrations,
          openOrderValue,
          recentOrders,
          recentMovements,
          fourteenDayMovements,
        ] = await Promise.all([
          transaction.salesOrder.count({
            where: { organizationId, status: 'DRAFT' },
          }),
          transaction.lowStockAlert.count({
            where: { organizationId, status: 'OPEN' },
          }),
          transaction.integrationDelivery.count({
            where: { organizationId, status: 'FAILED' },
          }),
          transaction.salesOrder.aggregate({
            _sum: { subtotal: true },
            where: {
              organizationId,
              status: { in: ['DRAFT', 'CONFIRMED'] },
            },
          }),
          transaction.salesOrder.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
              createdAt: true,
              customerCompanyName: true,
              id: true,
              orderNumber: true,
              status: true,
              subtotal: true,
            },
            take: 8,
            where: { organizationId },
          }),
          transaction.stockMovement.findMany({
            include: { product: { select: { name: true, sku: true } } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 8,
            where: { organizationId },
          }),
          transaction.$queryRaw<
            Array<{ day: Date; inbound: number; outbound: number }>
          >`
            SELECT
              date_trunc('day', "created_at") AS day,
              COALESCE(SUM(CASE WHEN "quantity_delta" > 0 THEN "quantity_delta" ELSE 0 END), 0)::int AS inbound,
              COALESCE(SUM(CASE WHEN "quantity_delta" < 0 THEN ABS("quantity_delta") ELSE 0 END), 0)::int AS outbound
            FROM "stock_movements"
            WHERE "organization_id" = ${organizationId}::uuid
              AND "created_at" >= (CURRENT_DATE - INTERVAL '13 days')
            GROUP BY date_trunc('day', "created_at")
            ORDER BY day ASC
          `,
        ]);

        return {
          exceptions: {
            failedIntegrations,
            openLowStockAlerts,
            ordersAwaitingApproval,
          },
          plan,
          recentMovements: recentMovements.map((movement) => ({
            ...movement,
            createdAt: movement.createdAt.toISOString(),
          })),
          recentOrders: recentOrders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
            subtotal: order.subtotal.toFixed(2),
          })),
          fourteenDayMovements: fourteenDayMovements.map((row) => ({
            day: row.day.toISOString().slice(0, 10),
            inbound: row.inbound,
            outbound: row.outbound,
          })),
          openOrderValue: openOrderValue._sum.subtotal?.toFixed(2) ?? '0.00',
        };
      },
    );
  }
}
