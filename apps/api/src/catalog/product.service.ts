import { NotFoundException } from '@nestjs/common';
import type { ProductInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import { page, serializeProduct, withoutUndefined } from './catalog-mappers.js';
import type { CatalogListQuery, ProductUpdate } from './catalog.types.js';

export async function createProduct(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  organizationId: string,
  input: ProductInput,
) {
  const product = await transaction.product.create({
    data: { ...input, organizationId },
  });
  await recordAudit(transaction, {
    action: 'PRODUCT_CREATED',
    actorUserId: auth.user.id,
    after: serializeProduct(product),
    entityId: product.id,
    entityType: 'Product',
    organizationId,
  });
  return serializeProduct(product);
}

export async function listProducts(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: CatalogListQuery,
) {
  const where: Prisma.ProductWhereInput = { organizationId };
  if (!query.includeInactive) where.isActive = true;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  const [items, total] = await Promise.all([
    transaction.product.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.product.count({ where }),
  ]);
  return page(items.map(serializeProduct), total, query);
}

export async function getProduct(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  id: string,
) {
  const product = await transaction.product.findFirst({
    where: { id, organizationId },
  });
  if (!product) throw new NotFoundException('Product not found.');
  return serializeProduct(product);
}

export async function updateProduct(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  organizationId: string,
  id: string,
  input: ProductUpdate,
) {
  const existing = await transaction.product.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new NotFoundException('Product not found.');
  const product = await transaction.product.update({
    data: withoutUndefined(input),
    where: { id },
  });
  await recordAudit(transaction, {
    action: 'PRODUCT_UPDATED',
    actorUserId: auth.user.id,
    after: serializeProduct(product),
    before: serializeProduct(existing),
    entityId: product.id,
    entityType: 'Product',
    organizationId,
  });
  return serializeProduct(product);
}
