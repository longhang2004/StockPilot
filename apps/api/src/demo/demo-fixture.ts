import type { Prisma } from '../generated/prisma/client.js';

import {
  balanceQuantities,
  customerFixtures,
  DEMO_FIXTURE_COUNTS,
  fixtureId,
  fulfilledSaleMovements,
  money,
  orderFixtures,
  productFixtures,
  receiptQuantities,
  relativeDate,
  RESET_INTERVAL_MS,
  supplierFixtures,
} from './demo-fixture-data.js';

export { DEMO_FIXTURE_COUNTS, fixtureId };

type FixtureTransaction = Prisma.TransactionClient;

export interface DemoFixtureActors {
  managerUserId: string;
  ownerUserId: string;
  staffUserId: string;
  warehouseId: string;
}

export interface SeedDemoFixtureOptions extends DemoFixtureActors {
  organizationId: string;
  /** Only reset callers should set this. The reset function has already deleted all operational rows. */
  force?: boolean;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function hasOperationalData(
  transaction: FixtureTransaction,
  organizationId: string,
): Promise<boolean> {
  const counts = await Promise.all([
    transaction.product.count({ where: { organizationId } }),
    transaction.customer.count({ where: { organizationId } }),
    transaction.supplier.count({ where: { organizationId } }),
    transaction.inventoryBalance.count({ where: { organizationId } }),
    transaction.goodsReceipt.count({ where: { organizationId } }),
    transaction.salesOrder.count({ where: { organizationId } }),
    transaction.integrationDelivery.count({ where: { organizationId } }),
    transaction.productImportRun.count({ where: { organizationId } }),
  ]);
  return counts.some((count) => count > 0);
}

/**
 * Seeds the deterministic demo operational fixture inside a caller-owned
 * transaction. Skips (returns false) when the organization already has
 * operational data unless `force` is set — reset callers delete first and
 * pass `force: true`. The fixture declarations live in demo-fixture-data.ts;
 * this module only orchestrates them.
 */
export async function seedDemoFixture(
  transaction: FixtureTransaction,
  options: SeedDemoFixtureOptions,
): Promise<boolean> {
  if (
    !options.force &&
    (await hasOperationalData(transaction, options.organizationId))
  ) {
    return false;
  }

  const {
    organizationId,
    warehouseId,
    managerUserId,
    ownerUserId,
    staffUserId,
  } = options;
  const now = new Date();
  const actorByRole = {
    manager: managerUserId,
    staff: staffUserId,
  };
  const products = new Map<string, string>();
  const customers = new Map<string, string>();
  const suppliers = new Map<string, string>();

  for (const product of productFixtures) {
    const id = fixtureId(organizationId, product.key);
    products.set(product.key, id);
    await transaction.product.create({
      data: {
        description: product.description,
        id,
        isActive: product.key !== 'product-9-inactive',
        name: product.name,
        organizationId,
        reorderPoint: product.reorderPoint,
        salePrice: product.salePrice,
        sku: product.sku,
      },
    });
  }

  for (const customer of customerFixtures) {
    const id = fixtureId(organizationId, customer.key);
    customers.set(customer.key, id);
    await transaction.customer.create({
      data: {
        companyName: customer.companyName,
        contactName: customer.contactName,
        email: `${customer.key}@harborpine.example`,
        id,
        organizationId,
      },
    });
  }

  for (const supplier of supplierFixtures) {
    const id = fixtureId(organizationId, supplier.key);
    suppliers.set(supplier.key, id);
    await transaction.supplier.create({
      data: {
        companyName: supplier.companyName,
        contactName: supplier.contactName,
        email: `${supplier.key}@harborpine.example`,
        id,
        organizationId,
      },
    });
  }

  const receiptId = fixtureId(organizationId, 'goods-receipt-1');
  const receiptDate = relativeDate(now, 3 * 24 * 60);
  const supplierId = suppliers.get('supplier-1');
  if (!supplierId) throw new Error('Demo supplier fixture is incomplete.');
  await transaction.goodsReceipt.create({
    data: {
      actorUserId: managerUserId,
      id: receiptId,
      organizationId,
      receiptNumber: 'GR-2026-001',
      receivedAt: receiptDate,
      supplierId,
      warehouseId,
    },
  });

  for (const product of productFixtures.slice(0, 8)) {
    const productId = products.get(product.key);
    const quantity = receiptQuantities[product.key];
    if (!productId || quantity === undefined)
      throw new Error('Demo receipt fixture is incomplete.');
    await transaction.goodsReceiptLine.create({
      data: {
        goodsReceiptId: receiptId,
        id: fixtureId(organizationId, `goods-receipt-1-line-${product.key}`),
        organizationId,
        productId,
        quantity,
        unitCost: (Number(product.salePrice) * 0.62).toFixed(2),
      },
    });
    await transaction.stockMovement.create({
      data: {
        actorUserId: managerUserId,
        createdAt: receiptDate,
        id: fixtureId(organizationId, `movement-receipt-${product.key}`),
        onHandAfter: quantity,
        organizationId,
        productId,
        quantityDelta: quantity,
        referenceId: receiptId,
        referenceType: 'GOODS_RECEIPT',
        type: 'RECEIPT',
        warehouseId,
      },
    });
  }

  for (const product of productFixtures.slice(0, 8)) {
    const productId = products.get(product.key);
    const quantities = balanceQuantities[product.key];
    if (!productId || !quantities)
      throw new Error('Demo balance fixture is incomplete.');
    await transaction.inventoryBalance.create({
      data: {
        id: fixtureId(organizationId, `balance-${product.key}`),
        onHand: quantities.onHand,
        organizationId,
        productId,
        reserved: quantities.reserved,
        version: quantities.version,
        warehouseId,
      },
    });
  }

  const orderIds = new Map<string, string>();
  for (const orderFixture of orderFixtures) {
    const orderId = fixtureId(organizationId, orderFixture.key);
    orderIds.set(orderFixture.key, orderId);
    const customerId = customers.get(orderFixture.customerKey);
    const customerFixture = customerFixtures.find(
      (item) => item.key === orderFixture.customerKey,
    );
    const product = productFixtures.find(
      (item) => item.key === orderFixture.line.productKey,
    );
    const productId = products.get(orderFixture.line.productKey);
    const createdByUserId = actorByRole[orderFixture.createdByRole];
    if (!customerId || !customerFixture || !product || !productId)
      throw new Error('Demo order fixture is incomplete.');
    const createdAt = relativeDate(now, orderFixture.timeOffsetMinutes);
    const subtotal = money(product.salePrice, orderFixture.line.quantity);
    const confirmedAt =
      orderFixture.status === 'DRAFT'
        ? null
        : new Date(createdAt.getTime() + 15 * 60 * 1000);
    const fulfilledAt =
      orderFixture.status === 'FULFILLED'
        ? new Date(createdAt.getTime() + 45 * 60 * 1000)
        : null;
    const cancelledAt =
      orderFixture.status === 'CANCELLED'
        ? new Date(createdAt.getTime() + 30 * 60 * 1000)
        : null;
    await transaction.salesOrder.create({
      data: {
        cancelledAt,
        confirmedAt,
        createdAt,
        createdByUserId,
        customerCompanyName: customerFixture.companyName,
        customerContactName: customerFixture.contactName,
        customerEmail: `${orderFixture.customerKey}@harborpine.example`,
        customerId,
        fulfilledAt,
        id: orderId,
        note:
          orderFixture.status === 'CANCELLED'
            ? 'Cancelled by customer before dispatch.'
            : null,
        orderNumber: orderFixture.orderNumber,
        organizationId,
        status: orderFixture.status,
        subtotal,
        updatedAt: createdAt,
        warehouseId,
      },
    });
    const lineId = fixtureId(organizationId, `${orderFixture.key}-line`);
    await transaction.salesOrderLine.create({
      data: {
        id: lineId,
        lineTotal: subtotal,
        organizationId,
        productId,
        productNameSnapshot: product.name,
        quantity: orderFixture.line.quantity,
        salesOrderId: orderId,
        skuSnapshot: product.sku,
        unitPrice: product.salePrice,
      },
    });
    const transitions: Array<{
      fromStatus: 'CONFIRMED' | 'DRAFT' | null;
      toStatus: 'CANCELLED' | 'CONFIRMED' | 'DRAFT' | 'FULFILLED';
    }> = [{ fromStatus: null, toStatus: 'DRAFT' }];
    if (orderFixture.status === 'CONFIRMED') {
      transitions.push({ fromStatus: 'DRAFT', toStatus: 'CONFIRMED' });
    }
    if (orderFixture.status === 'FULFILLED') {
      transitions.push({ fromStatus: 'DRAFT', toStatus: 'CONFIRMED' });
      transitions.push({ fromStatus: 'CONFIRMED', toStatus: 'FULFILLED' });
    }
    if (orderFixture.status === 'CANCELLED') {
      transitions.push({ fromStatus: 'DRAFT', toStatus: 'CANCELLED' });
    }
    for (const [index, transition] of transitions.entries()) {
      await transaction.orderTransition.create({
        data: {
          actorUserId:
            transition.toStatus === 'FULFILLED' ? staffUserId : managerUserId,
          createdAt: new Date(
            createdAt.getTime() + (index + 1) * 15 * 60 * 1000,
          ),
          fromStatus: transition.fromStatus,
          id: fixtureId(
            organizationId,
            `${orderFixture.key}-transition-${index + 1}`,
          ),
          note: null,
          organizationId,
          salesOrderId: orderId,
          toStatus: transition.toStatus,
        },
      });
    }
  }

  for (const sale of fulfilledSaleMovements) {
    const orderId = orderIds.get(sale.orderKey);
    const productId = products.get(sale.productKey);
    if (!orderId || !productId)
      throw new Error('Demo sale fixture is incomplete.');
    await transaction.stockMovement.create({
      data: {
        actorUserId: staffUserId,
        createdAt: relativeDate(
          now,
          sale.orderKey.endsWith('1') ? 17 * 60 : 11 * 60,
        ),
        id: fixtureId(organizationId, `movement-sale-${sale.productKey}`),
        onHandAfter: sale.onHandAfter,
        organizationId,
        productId,
        quantityDelta: -sale.quantity,
        referenceId: orderId,
        referenceType: 'SALES_ORDER',
        type: 'SALE',
        warehouseId,
      },
    });
  }

  for (const productKey of ['product-2', 'product-3']) {
    const product = productFixtures.find((item) => item.key === productKey);
    const productId = products.get(productKey);
    const quantities = balanceQuantities[productKey];
    if (!product || !productId || !quantities)
      throw new Error('Demo alert fixture is incomplete.');
    await transaction.lowStockAlert.create({
      data: {
        availableAtOpen: quantities.onHand - quantities.reserved,
        id: fixtureId(organizationId, `alert-${productKey}`),
        openedAt: relativeDate(now, 90),
        organizationId,
        productId,
        reorderPoint: product.reorderPoint,
        status: 'OPEN',
        warehouseId,
      },
    });
  }

  const failedDeliveryId = fixtureId(
    organizationId,
    'integration-delivery-failed',
  );
  await transaction.integrationDelivery.create({
    data: {
      attempts: 2,
      createdAt: relativeDate(now, 45),
      eventType: 'order.created',
      externalDeliveryId: 'storefront-demo-failure-001',
      id: failedDeliveryId,
      lastError: 'Queue worker unavailable during processing; retry available.',
      organizationId,
      payload: json({
        customer: {
          companyName: 'Demo Storefront',
          email: 'orders@demo-storefront.example',
        },
        eventType: 'order.created',
        externalOrderId: 'DEMO-FAIL-001',
        items: [{ quantity: 2, sku: 'HP-1002' }],
      }),
      status: 'FAILED',
      updatedAt: relativeDate(now, 45),
    },
  });

  const importRunId = fixtureId(organizationId, 'product-import-run');
  await transaction.productImportRun.create({
    data: {
      createdAt: relativeDate(now, 60),
      createdByUserId: managerUserId,
      errors: json([
        {
          field: 'salePrice',
          message: 'Must be a valid money amount.',
          row: 3,
        },
      ]),
      fileName: 'demo-products.csv',
      id: importRunId,
      organizationId,
      rowsInvalid: 1,
      rowsTotal: 2,
      rowsValid: 1,
      status: 'PREVIEW',
      updatedAt: relativeDate(now, 60),
      validRows: json([
        {
          description: 'Demo import preview row',
          isActive: true,
          name: 'Preview Product',
          reorderPoint: 2,
          salePrice: '14.00',
          sku: 'DEMO-PREVIEW-1',
        },
      ]),
    },
  });

  const auditRows: Array<{
    action: string;
    actorUserId: string;
    after?: Prisma.InputJsonValue;
    before?: Prisma.InputJsonValue;
    entityId: string;
    entityType: string;
    minutesAgo: number;
  }> = [
    {
      action: 'DEMO_FIXTURE_SEEDED',
      actorUserId: ownerUserId,
      after: json({ version: 1 }),
      entityId: organizationId,
      entityType: 'Organization',
      minutesAgo: 2,
    },
    {
      action: 'RECEIPT_APPLIED',
      actorUserId: managerUserId,
      after: json({ receiptNumber: 'GR-2026-001', lineCount: 8 }),
      entityId: receiptId,
      entityType: 'GoodsReceipt',
      minutesAgo: 3 * 24 * 60,
    },
    {
      action: 'ORDER_CONFIRMED',
      actorUserId: managerUserId,
      after: json({ fromStatus: 'DRAFT', toStatus: 'CONFIRMED' }),
      before: json({ status: 'DRAFT' }),
      entityId: orderIds.get('order-confirmed-1') ?? receiptId,
      entityType: 'SalesOrder',
      minutesAgo: 23 * 60,
    },
    {
      action: 'ORDER_FULFILLED',
      actorUserId: staffUserId,
      after: json({ fromStatus: 'CONFIRMED', toStatus: 'FULFILLED' }),
      before: json({ status: 'CONFIRMED' }),
      entityId: orderIds.get('order-fulfilled-1') ?? receiptId,
      entityType: 'SalesOrder',
      minutesAgo: 16 * 60,
    },
    {
      action: 'INTEGRATION_FAILED',
      actorUserId: managerUserId,
      after: json({
        status: 'FAILED',
        externalDeliveryId: 'storefront-demo-failure-001',
      }),
      entityId: failedDeliveryId,
      entityType: 'IntegrationDelivery',
      minutesAgo: 45,
    },
    {
      action: 'PRODUCT_IMPORT_PREVIEWED',
      actorUserId: managerUserId,
      after: json({ rowsTotal: 2, rowsValid: 1, rowsInvalid: 1 }),
      entityId: importRunId,
      entityType: 'ProductImportRun',
      minutesAgo: 60,
    },
  ];
  for (const audit of auditRows) {
    await transaction.auditEvent.create({
      data: {
        action: audit.action,
        actorUserId: audit.actorUserId,
        ...(audit.after ? { after: audit.after } : {}),
        ...(audit.before ? { before: audit.before } : {}),
        createdAt: relativeDate(now, audit.minutesAgo),
        entityId: audit.entityId,
        entityType: audit.entityType,
        id: fixtureId(organizationId, `audit-${audit.action}`),
        organizationId,
      },
    });
  }

  return true;
}

export async function findDemoFixtureActors(
  transaction: FixtureTransaction,
  organizationId: string,
): Promise<DemoFixtureActors> {
  const [warehouse, memberships] = await Promise.all([
    transaction.warehouse.findUnique({ where: { organizationId } }),
    transaction.membership.findMany({
      select: { role: true, userId: true },
      where: { organizationId },
    }),
  ]);
  if (!warehouse) throw new Error('Demo warehouse is missing.');
  const byRole = new Map(
    memberships.map((membership) => [membership.role, membership.userId]),
  );
  const ownerUserId = byRole.get('OWNER');
  const managerUserId = byRole.get('MANAGER');
  const staffUserId = byRole.get('STAFF');
  if (!ownerUserId || !managerUserId || !staffUserId) {
    throw new Error('Demo memberships are incomplete.');
  }
  return { managerUserId, ownerUserId, staffUserId, warehouseId: warehouse.id };
}

export function nextDemoResetAt(now = new Date()): Date {
  return new Date(now.getTime() + RESET_INTERVAL_MS);
}
