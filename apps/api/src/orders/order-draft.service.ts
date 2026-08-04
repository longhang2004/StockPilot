import { randomUUID } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import type { SalesOrderInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import type { Prisma, Product } from '../generated/prisma/client.js';

export async function createDraftOrder(
  transaction: Prisma.TransactionClient,
  auth: AuthContext,
  input: SalesOrderInput,
) {
  const organizationId = auth.membership.organization.id;
  const [warehouse, customer, products] = await Promise.all([
    transaction.warehouse.findUnique({ where: { organizationId } }),
    transaction.customer.findFirst({
      where: { id: input.customerId, isActive: true, organizationId },
    }),
    transaction.product.findMany({
      where: {
        id: { in: input.lines.map((line) => line.productId) },
        isActive: true,
        organizationId,
      },
    }),
  ]);
  if (!warehouse) throw new NotFoundException('Warehouse not found.');
  if (!customer) throw new NotFoundException('Active customer not found.');
  if (products.length !== input.lines.length) {
    throw new NotFoundException('One or more active products were not found.');
  }
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const subtotal = input.lines.reduce((sum, line) => {
    const product = productsById.get(line.productId);
    return sum + Number(product?.salePrice ?? 0) * line.quantity;
  }, 0);
  const order = await transaction.salesOrder.create({
    data: {
      createdByUserId: auth.user.id,
      customerCompanyName: customer.companyName,
      customerContactName: customer.contactName,
      customerEmail: customer.email,
      customerId: customer.id,
      note: input.note,
      orderNumber: `SO-${Date.now()}-${randomUUID().slice(0, 8)}`,
      organizationId,
      status: 'DRAFT',
      subtotal: subtotal.toFixed(2),
      warehouseId: warehouse.id,
    },
  });
  await createDraftLines(
    transaction,
    organizationId,
    order.id,
    input,
    productsById,
  );
  await transaction.orderTransition.create({
    data: {
      actorUserId: auth.user.id,
      fromStatus: null,
      organizationId,
      salesOrderId: order.id,
      toStatus: 'DRAFT',
    },
  });
  await recordAudit(transaction, {
    action: 'ORDER_CREATED',
    actorUserId: auth.user.id,
    after: { orderId: order.id, subtotal: subtotal.toFixed(2) },
    entityId: order.id,
    entityType: 'SalesOrder',
    organizationId,
  });
  return { id: order.id, subtotal };
}

export async function replaceDraftLines(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
  input: SalesOrderInput,
) {
  const customer = await transaction.customer.findFirst({
    where: { id: input.customerId, isActive: true, organizationId },
  });
  const products = await transaction.product.findMany({
    where: {
      id: { in: input.lines.map((line) => line.productId) },
      isActive: true,
      organizationId,
    },
  });
  if (!customer || products.length !== input.lines.length) {
    throw new NotFoundException('Active order partner or product not found.');
  }
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const subtotal = input.lines.reduce((sum, line) => {
    const product = productsById.get(line.productId);
    return sum + Number(product?.salePrice ?? 0) * line.quantity;
  }, 0);
  await createDraftLines(
    transaction,
    organizationId,
    orderId,
    input,
    productsById,
  );
  return { customer, subtotal };
}

async function createDraftLines(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
  input: SalesOrderInput,
  productsById: Map<string, Pick<Product, 'id' | 'name' | 'sku' | 'salePrice'>>,
) {
  for (const line of input.lines) {
    const product = productsById.get(line.productId);
    if (!product) throw new NotFoundException('Active product not found.');
    await transaction.salesOrderLine.create({
      data: {
        lineTotal: (Number(product.salePrice) * line.quantity).toFixed(2),
        organizationId,
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: line.quantity,
        salesOrderId: orderId,
        skuSnapshot: product.sku,
        unitPrice: product.salePrice,
      },
    });
  }
}
