import { z } from 'zod';

import type { Plan } from './auth.js';
import type { StockMovementType } from './inventory.js';

/**
 * Overview dashboard response returned by GET /v1/dashboard/overview.
 * These are plain interfaces (not Zod schemas): the API is the single
 * producer and the web client consumes them read-only.
 */
export interface OverviewMovementRow {
  day: string;
  inbound: number;
  outbound: number;
}

export interface OverviewRecentOrder {
  createdAt: string;
  customerCompanyName: string;
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED';
  subtotal: string;
}

export interface OverviewRecentMovement {
  createdAt: string;
  id: string;
  product?: { name: string; sku: string };
  quantityDelta: number;
  type: StockMovementType;
}

export interface OverviewResponse {
  exceptions: {
    failedIntegrations: number;
    openLowStockAlerts: number;
    ordersAwaitingApproval: number;
  };
  fourteenDayMovements: OverviewMovementRow[];
  openOrderValue: string;
  plan: Plan;
  recentMovements: OverviewRecentMovement[];
  recentOrders: OverviewRecentOrder[];
}

/** Body returned by GET /v1/analytics. */
export const AnalyticsResponseSchema = z.object({
  averageFulfilledOrderValue: z.string(),
  fulfilledOrderCount: z.number().int(),
  fulfilledOrderValue: z.string(),
  lowStockSkuCount: z.number().int(),
  ordersByStatus: z.array(
    z.object({
      count: z.number().int(),
      status: z.string(),
    }),
  ),
  topFulfilledProducts: z.array(
    z.object({
      name: z.string(),
      sku: z.string(),
      unitsFulfilled: z.number().int(),
    }),
  ),
});
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
