import { NotFoundException } from '@nestjs/common';
import type { SupplierInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import { page, supplierWhere, withoutUndefined } from './catalog-mappers.js';
import type { CatalogListQuery, PartnerUpdate } from './catalog.types.js';

export async function createSupplier(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  organizationId: string,
  input: SupplierInput,
) {
  const supplier = await transaction.supplier.create({
    data: { ...input, organizationId },
  });
  await recordAudit(transaction, {
    action: 'SUPPLIER_CREATED',
    actorUserId: auth.user.id,
    after: supplier,
    entityId: supplier.id,
    entityType: 'Supplier',
    organizationId,
  });
  return supplier;
}

export async function listSuppliers(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: CatalogListQuery,
) {
  const where = supplierWhere(organizationId, query);
  const [items, total] = await Promise.all([
    transaction.supplier.findMany({
      orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.supplier.count({ where }),
  ]);
  return page(items, total, query);
}

export async function getSupplier(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  id: string,
) {
  const supplier = await transaction.supplier.findFirst({
    where: { id, organizationId },
  });
  if (!supplier) throw new NotFoundException('Supplier not found.');
  return supplier;
}

export async function updateSupplier(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  organizationId: string,
  id: string,
  input: PartnerUpdate,
) {
  const existing = await transaction.supplier.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new NotFoundException('Supplier not found.');
  const supplier = await transaction.supplier.update({
    data: withoutUndefined(input),
    where: { id },
  });
  await recordAudit(transaction, {
    action: 'SUPPLIER_UPDATED',
    actorUserId: auth.user.id,
    after: supplier,
    before: existing,
    entityId: supplier.id,
    entityType: 'Supplier',
    organizationId,
  });
  return supplier;
}
