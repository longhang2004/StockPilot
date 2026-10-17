import type { StockMovementType } from '@stockpilot/contracts';

export interface InventoryListQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
}

export interface MovementListQuery extends InventoryListQuery {
  type?: StockMovementType | undefined;
}

export type AlertStatusFilter = 'OPEN' | 'RESOLVED';
