import type { CustomerInput, ProductInput } from '@stockpilot/contracts';

export interface CatalogListQuery {
  includeInactive: boolean;
  page: number;
  pageSize: number;
  search: string;
}

type LoosePartial<T> = { [Key in keyof T]?: T[Key] | undefined };

export type ProductUpdate = LoosePartial<ProductInput> & {
  isActive?: boolean | undefined;
};

export type PartnerUpdate = LoosePartial<CustomerInput> & {
  isActive?: boolean | undefined;
};
