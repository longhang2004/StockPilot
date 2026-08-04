import { ConflictException, NotFoundException } from '@nestjs/common';

import { recordAudit } from '../audit/audit-record.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { MockStorefrontOrder } from './integration.types.js';

export async function createStorefrontDraftOrder(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  actorUserId: string,
  payload: MockStorefrontOrder,
) {
  const warehouse = await transaction.warehouse.findUnique({
    where: { organizationId },
  });
  if (!warehouse) throw new NotFoundException('Warehouse not found.');
  const skus = payload.items.map((item) => item.sku.toUpperCase());
  if (new Set(skus).size !== skus.length) {
    throw new ConflictException('Webhook order contains duplicate SKUs.');
  }
  const products = await transaction.product.findMany({
    where: { isActive: true, organizationId, sku: { in: skus } },
  });
  const productsBySku = new Map(
    products.map((product) => [product.sku, product]),
  );
  if (products.length !== skus.length) {
    const missing = skus.filter((sku) => !productsBySku.has(sku));
    throw new NotFoundException(`Unknown SKU(s): ${missing.join(', ')}.`);
  }
  const existingCustomer = payload.customer.email
    ? await transaction.customer.findFirst({
        where: {
          email: payload.customer.email,
          isActive: true,
          organizationId,
        },
      })
    : null;
  const customer =
    existingCustomer ??
    (await transaction.customer.create({
      data: {
        companyName: payload.customer.companyName,
        contactName: payload.customer.contactName ?? null,
        email: payload.customer.email ?? null,
        organizationId,
        phone: payload.customer.phone ?? null,
      },
    }));
  const subtotal = payload.items.reduce((sum, item) => {
    const product = productsBySku.get(item.sku.toUpperCase());
    return sum + Number(product?.salePrice ?? 0) * item.quantity;
  }, 0);
  const order = await transaction.salesOrder.create({
    data: {
      createdByUserId: actorUserId,
      customerCompanyName: customer.companyName,
      customerContactName: customer.contactName,
      customerEmail: customer.email,
      customerId: customer.id,
      note: payload.note ?? null,
      orderNumber: `STORE-${payload.externalOrderId}-${Date.now()}`.slice(
        0,
        80,
      ),
      organizationId,
      status: 'DRAFT',
      subtotal: subtotal.toFixed(2),
      warehouseId: warehouse.id,
    },
  });
  for (const item of payload.items) {
    const product = productsBySku.get(item.sku.toUpperCase());
    if (!product) throw new NotFoundException(`Unknown SKU: ${item.sku}.`);
    await transaction.salesOrderLine.create({
      data: {
        lineTotal: (Number(product.salePrice) * item.quantity).toFixed(2),
        organizationId,
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: item.quantity,
        salesOrderId: order.id,
        skuSnapshot: product.sku,
        unitPrice: product.salePrice,
      },
    });
  }
  await transaction.orderTransition.create({
    data: {
      actorUserId,
      fromStatus: null,
      organizationId,
      salesOrderId: order.id,
      toStatus: 'DRAFT',
    },
  });
  await recordAudit(transaction, {
    action: 'ORDER_CREATED_FROM_INTEGRATION',
    actorUserId,
    after: { orderId: order.id, source: 'mock-storefront' },
    entityId: order.id,
    entityType: 'SalesOrder',
    organizationId,
  });
  return order;
}
