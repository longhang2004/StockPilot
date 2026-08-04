import { NotFoundException } from '@nestjs/common';
import type { CustomerInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import { customerWhere, page, withoutUndefined } from './catalog-mappers.js';
import type { CatalogListQuery, PartnerUpdate } from './catalog.types.js';

export async function createCustomer(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  organizationId: string,
  input: CustomerInput,
) {
  const customer = await transaction.customer.create({
    data: { ...input, organizationId },
  });
  await recordAudit(transaction, {
    action: 'CUSTOMER_CREATED',
    actorUserId: auth.user.id,
    after: customer,
    entityId: customer.id,
    entityType: 'Customer',
    organizationId,
  });
  return customer;
}

export async function listCustomers(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: CatalogListQuery,
) {
  const where = customerWhere(organizationId, query);
  const [items, total] = await Promise.all([
    transaction.customer.findMany({
      orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.customer.count({ where }),
  ]);
  return page(items, total, query);
}

export async function getCustomer(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  id: string,
) {
  const customer = await transaction.customer.findFirst({
    where: { id, organizationId },
  });
  if (!customer) throw new NotFoundException('Customer not found.');
  return customer;
}

export async function updateCustomer(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  organizationId: string,
  id: string,
  input: PartnerUpdate,
) {
  const existing = await transaction.customer.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new NotFoundException('Customer not found.');
  const customer = await transaction.customer.update({
    data: withoutUndefined(input),
    where: { id },
  });
  await recordAudit(transaction, {
    action: 'CUSTOMER_UPDATED',
    actorUserId: auth.user.id,
    after: customer,
    before: existing,
    entityId: customer.id,
    entityType: 'Customer',
    organizationId,
  });
  return customer;
}
