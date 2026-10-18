import type { StockMovementType } from '@stockpilot/contracts';

export interface InventoryListQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
}

export interface MovementListQuery extends InventoryListQuery {
  productId?: string | undefined;
  type?: StockMovementType | undefined;
}

export interface ReceiptListQuery {
  page: number;
  pageSize: number;
  search: string;
}

export interface ProductTraceQuery {
  reservationsPage: number;
  reservationsPageSize: number;
  movementsPage: number;
  movementsPageSize: number;
}

export type AlertStatusFilter = 'OPEN' | 'RESOLVED';
