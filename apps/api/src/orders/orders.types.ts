import type { OrderStatus } from '@stockpilot/contracts';

export interface OrderListQuery {
  page: number;
  pageSize: number;
  search: string;
  status?: OrderStatus | undefined;
}
