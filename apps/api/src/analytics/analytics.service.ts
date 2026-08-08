import { Inject, Injectable } from '@nestjs/common';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { TenantDatabase } from '../database/tenant-database.js';

export interface AnalyticsResponse {
  averageFulfilledOrderValue: string;
  fulfilledOrderCount: number;
  fulfilledOrderValue: string;
  lowStockSkuCount: number;
  ordersByStatus: Array<{ count: number; status: string }>;
  topFulfilledProducts: Array<{
    name: string;
    sku: string;
    unitsFulfilled: number;
  }>;
}

/**
 * Operational analytics computed directly from the append-only ledger and
 * order tables. No redundant aggregates: portfolio scale queries are cheap,
 * and every query runs inside the tenant-scoped RLS transaction.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  analytics(auth: AuthContext): Promise<AnalyticsResponse> {
    const membership = requireMembership(auth);
    const organizationId = membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const [ordersByStatus, fulfilled, topFulfilled, lowStockAlerts] =
          await Promise.all([
            transaction.salesOrder.groupBy({
              _count: { _all: true },
              by: ['status'],
            }),
            transaction.salesOrder.aggregate({
              _avg: { subtotal: true },
              _count: { id: true },
              _sum: { subtotal: true },
              where: { status: 'FULFILLED' },
            }),
            transaction.stockMovement.groupBy({
              _sum: { quantityDelta: true },
              by: ['productId'],
              orderBy: { _sum: { quantityDelta: 'asc' } },
              take: 5,
              where: { type: 'SALE' },
            }),
            transaction.lowStockAlert.count({ where: { status: 'OPEN' } }),
          ]);

        const productIds = topFulfilled
          .map((row) => row.productId)
          .filter((id): id is string => id !== null);
        const products = productIds.length
          ? await transaction.product.findMany({
              select: { id: true, name: true, sku: true },
              where: { id: { in: productIds } },
            })
          : [];
        const productById = new Map(
          products.map((product) => [product.id, product]),
        );

        return {
          averageFulfilledOrderValue:
            fulfilled._count.id > 0 && fulfilled._avg.subtotal !== null
              ? fulfilled._avg.subtotal.toFixed(2)
              : '0.00',
          fulfilledOrderCount: fulfilled._count.id,
          fulfilledOrderValue: fulfilled._sum.subtotal?.toFixed(2) ?? '0.00',
          lowStockSkuCount: lowStockAlerts,
          ordersByStatus: ordersByStatus.map((row) => ({
            count: row._count._all,
            status: row.status,
          })),
          topFulfilledProducts: topFulfilled.map((row) => {
            const product = productById.get(row.productId ?? '');
            return {
              name: product?.name ?? 'Unknown product',
              sku: product?.sku ?? row.productId ?? '—',
              unitsFulfilled: -1 * (row._sum.quantityDelta ?? 0),
            };
          }),
        };
      },
    );
  }
}
