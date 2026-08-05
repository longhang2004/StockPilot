import type { Role } from '@stockpilot/contracts';

import type { SessionResponse } from '../../lib/api-client';

export type SessionView = Pick<SessionResponse, 'membership' | 'user'>;

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  salePrice: string;
  reorderPoint: number;
  isActive: boolean;
  image: {
    url: string;
    width: number;
    height: number;
    format: string;
  } | null;
}

export interface PartnerRecord {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface BalanceRecord {
  id: string;
  productId: string;
  product: { sku: string; name: string };
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: string;
}

export interface AlertRecord {
  id: string;
  productId: string;
  product: { sku: string; name: string };
  status: 'OPEN' | 'RESOLVED';
  availableAtOpen: number;
  reorderPoint: number;
  openedAt: string;
  resolvedAt: string | null;
}

export interface MovementRecord {
  id: string;
  type: string;
  quantityDelta: number;
  createdAt: string;
  product?: { sku: string; name: string };
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerCompanyName: string;
  status: 'DRAFT' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED';
  subtotal: string;
  createdAt: string;
}

export interface OrderDetail extends OrderRecord {
  note: string | null;
  lines: Array<{
    id: string;
    skuSnapshot: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  transitions: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
  }>;
}

export interface IntegrationRecord {
  id: string;
  externalDeliveryId: string;
  eventType: string;
  status: 'RECEIVED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  attempts: number;
  lastError: string | null;
  payload: unknown;
  createdAt: string;
  processedAt: string | null;
}

export interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor?: { displayName: string } | null;
}

export interface OverviewResponse {
  exceptions: {
    ordersAwaitingApproval: number;
    openLowStockAlerts: number;
    failedIntegrations: number;
  };
  openOrderValue: string;
  recentOrders: OrderRecord[];
  recentMovements: MovementRecord[];
  inboundOutbound14d?: Array<{
    date: string;
    inbound: number;
    outbound: number;
  }>;
  fourteenDayMovements?: Array<{
    day: string;
    inbound: number;
    outbound: number;
  }>;
}

export type { Role };
