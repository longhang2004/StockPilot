import type { Prisma, Product } from '../generated/prisma/client.js';
import type { CatalogListQuery } from './catalog.types.js';
import { productImageUrl } from './product-image-storage.js';

export function serializeProduct(product: Product) {
  const {
    imageBytes,
    imageFormat,
    imageHeight,
    imagePublicId,
    imageVersion,
    imageWidth,
    ...productFields
  } = product;
  return {
    ...productFields,
    image:
      imagePublicId &&
      imageVersion &&
      imageFormat &&
      imageWidth &&
      imageHeight &&
      imageBytes
        ? {
            format: imageFormat,
            height: imageHeight,
            url: productImageUrl(imagePublicId, imageVersion),
            width: imageWidth,
          }
        : null,
    salePrice: product.salePrice.toFixed(2),
  };
}

/** Keep derived delivery URLs out of the JSON audit snapshot persisted in SQL. */
export function serializeProductAudit(product: Product) {
  const serialized = serializeProduct(product);
  if (!serialized.image) return serialized;
  const { url: _url, ...imageMetadata } = serialized.image;
  return { ...serialized, image: imageMetadata };
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
