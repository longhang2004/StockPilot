import type {
  AuditRecord,
  Customer,
  IntegrationDeliveryRecord,
  InventoryBalance,
  LowStockAlert,
  OverviewRecentMovement,
  OverviewRecentOrder,
  OverviewResponse,
  Product,
  Role,
  SalesOrder,
  SalesOrderDetail,
  SessionInfo,
  StockMovementItem,
} from '@stockpilot/contracts';

import type { SessionResponse } from '../../lib/api-client';

export type SessionView = Pick<SessionResponse, 'membership' | 'user'>;

/**
 * Session guaranteed to hold a membership: the workspace shell only renders
 * workspace content after resolving a membership, so screens can rely on it.
 */
export type WorkspaceSessionView = SessionView & {
  membership: NonNullable<SessionView['membership']>;
};

export type { OverviewResponse, Role, SessionInfo };
export type { OverviewRecentMovement, OverviewRecentOrder };

/**
 * Feature-facing aliases over the shared wire contracts. The API is the
 * single producer of these shapes; the web client consumes them read-only
 * (no runtime parsing at the boundary).
 */
export type ProductRecord = Product;
export type PartnerRecord = Customer;
export type BalanceRecord = InventoryBalance;
export type AlertRecord = LowStockAlert;
export type MovementRecord = StockMovementItem;
export type OrderRecord = SalesOrder;
export type OrderDetail = SalesOrderDetail;
export type IntegrationRecord = IntegrationDeliveryRecord;
export type { AuditRecord };
