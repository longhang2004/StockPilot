import type { Prisma, Product } from '../generated/prisma/client.js';
import type { CatalogListQuery } from './catalog.types.js';

export function serializeProduct(product: Product) {
  return { ...product, salePrice: product.salePrice.toFixed(2) };
}

export function customerWhere(
  organizationId: string,
  query: CatalogListQuery,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { organizationId };
  if (!query.includeInactive) where.isActive = true;
  if (query.search) {
    where.OR = [
      { companyName: { contains: query.search, mode: 'insensitive' } },
      { contactName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function supplierWhere(
  organizationId: string,
  query: CatalogListQuery,
): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = { organizationId };
  if (!query.includeInactive) where.isActive = true;
  if (query.search) {
    where.OR = [
      { companyName: { contains: query.search, mode: 'insensitive' } },
      { contactName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function page<T>(items: T[], total: number, query: CatalogListQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export function withoutUndefined<T extends object>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter((entry) => entry[1] !== undefined),
  );
}
