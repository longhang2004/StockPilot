import { createHash } from 'node:crypto';

import type { Prisma } from '../generated/prisma/client.js';

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

export const DEMO_FIXTURE_COUNTS = {
  activeProducts: 8,
  cancelledOrders: 1,
  confirmedOrders: 1,
  customers: 5,
  draftOrders: 2,
  failedDeliveries: 1,
  fulfilledOrders: 2,
  inactiveProducts: 1,
  invalidImportRows: 1,
  lowStockAlerts: 2,
  suppliers: 3,
} as const;

const RESET_INTERVAL_MS = 6 * 60 * 60 * 1000;

const productFixtures = [
  {
    description: 'Reliable carton sealing tape for daily dispatches.',
    key: 'product-1',
    name: 'Packing Tape 48mm',
    reorderPoint: 8,
    salePrice: '12.50',
    sku: 'HP-1001',
  },
  {
    description: 'Double-wall cartons sized for wholesale case packing.',
    key: 'product-2',
    name: 'Kraft Carton Large',
    reorderPoint: 12,
    salePrice: '18.00',
    sku: 'HP-1002',
  },
  {
    description: 'Thermal labels for parcel and pallet shipments.',
    key: 'product-3',
    name: 'Thermal Labels 4x6',
    reorderPoint: 10,
    salePrice: '24.00',
    sku: 'HP-1003',
  },
  {
    description: 'Powder-free nitrile gloves for warehouse handling.',
    key: 'product-4',
    name: 'Nitrile Gloves L',
    reorderPoint: 6,
    salePrice: '32.50',
    sku: 'HP-1004',
  },
  {
    description: 'Clear stretch wrap for pallet stability.',
    key: 'product-5',
    name: 'Stretch Wrap 500mm',
    reorderPoint: 5,
    salePrice: '15.75',
    sku: 'HP-1005',
  },
  {
    description: 'Permanent marker set for bin and carton labelling.',
    key: 'product-6',
    name: 'Warehouse Marker Set',
    reorderPoint: 4,
    salePrice: '9.90',
    sku: 'HP-1006',
  },
  {
    description: 'Protective guards for pallet corners in transit.',
    key: 'product-7',
    name: 'Pallet Corner Guards',
    reorderPoint: 5,
    salePrice: '21.00',
    sku: 'HP-1007',
  },
  {
    description: 'Bright inventory tags for fast cycle counts.',
    key: 'product-8',
    name: 'Inventory Tags',
    reorderPoint: 3,
    salePrice: '7.25',
    sku: 'HP-1008',
  },
  {
    description: 'Retired mailer kept for historical order snapshots.',
    key: 'product-9-inactive',
    name: 'Legacy Poly Mailer',
    reorderPoint: 0,
    salePrice: '5.00',
    sku: 'HP-1009',
  },
] as const;

const customerFixtures = [
  {
    companyName: 'Northstar Office Supply',
    contactName: 'Avery Chen',
    key: 'customer-1',
  },
  {
    companyName: 'Cedar Street Market',
    contactName: 'Mina Patel',
    key: 'customer-2',
  },
  {
    companyName: 'Bluebird Hospitality',
    contactName: 'Jordan Lee',
    key: 'customer-3',
  },
  {
    companyName: 'Atlas Facilities Group',
    contactName: 'Riley Nguyen',
    key: 'customer-4',
  },
  {
    companyName: 'Goodship Retail Co.',
    contactName: 'Taylor Morgan',
    key: 'customer-5',
  },
] as const;

const supplierFixtures = [
  {
    companyName: 'Evergreen Packaging',
    contactName: 'Casey Wright',
    key: 'supplier-1',
  },
  {
    companyName: 'Harbor Safety Goods',
    contactName: 'Emery Brooks',
    key: 'supplier-2',
  },
  {
    companyName: 'Signal Label Works',
    contactName: 'Quinn Adams',
    key: 'supplier-3',
  },
] as const;

const receiptQuantities: Record<string, number> = {
  'product-1': 25,
  'product-2': 12,
  'product-3': 8,
  'product-4': 50,
  'product-5': 20,
  'product-6': 15,
  'product-7': 10,
  'product-8': 25,
};

const balanceQuantities: Record<
  string,
  { onHand: number; reserved: number; version: number }
> = {
  'product-1': { onHand: 20, reserved: 4, version: 3 },
  'product-2': { onHand: 12, reserved: 0, version: 1 },
  'product-3': { onHand: 8, reserved: 0, version: 1 },
  'product-4': { onHand: 40, reserved: 0, version: 2 },
  'product-5': { onHand: 20, reserved: 0, version: 1 },
  'product-6': { onHand: 15, reserved: 0, version: 1 },
  'product-7': { onHand: 10, reserved: 0, version: 1 },
  'product-8': { onHand: 25, reserved: 0, version: 1 },
};

interface OrderFixture {
  createdByUserId: string;
  customerKey: string;
  key: string;
  line: { productKey: string; quantity: number };
  orderNumber: string;
  status: 'CANCELLED' | 'CONFIRMED' | 'DRAFT' | 'FULFILLED';
  timeOffsetMinutes: number;
}

function fixtureId(organizationId: string, key: string): string {
  const digest = createHash('sha1')
    .update(`stockpilot-demo-fixture:v1:${organizationId}:${key}`)
    .digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function relativeDate(now: Date, minutesAgo: number): Date {
  return new Date(now.getTime() - minutesAgo * 60 * 1000);
}

function money(value: string, quantity: number): string {
  return (Number(value) * quantity).toFixed(2);
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

  const orders: OrderFixture[] = [
    {
      createdByUserId: staffUserId,
      customerKey: 'customer-1',
      key: 'order-draft-1',
      line: { productKey: 'product-1', quantity: 2 },
      orderNumber: 'SO-2026-1001',
      status: 'DRAFT',
      timeOffsetMinutes: 2 * 24 * 60,
    },
    {
      createdByUserId: staffUserId,
      customerKey: 'customer-2',
      key: 'order-draft-2',
      line: { productKey: 'product-5', quantity: 3 },
      orderNumber: 'SO-2026-1002',
      status: 'DRAFT',
      timeOffsetMinutes: 36 * 60,
    },
    {
      createdByUserId: managerUserId,
      customerKey: 'customer-3',
      key: 'order-confirmed-1',
      line: { productKey: 'product-1', quantity: 4 },
      orderNumber: 'SO-2026-1003',
      status: 'CONFIRMED',
      timeOffsetMinutes: 24 * 60,
    },
    {
      createdByUserId: managerUserId,
      customerKey: 'customer-4',
      key: 'order-fulfilled-1',
      line: { productKey: 'product-1', quantity: 5 },
      orderNumber: 'SO-2026-1004',
      status: 'FULFILLED',
      timeOffsetMinutes: 18 * 60,
    },
    {
      createdByUserId: managerUserId,
      customerKey: 'customer-5',
      key: 'order-fulfilled-2',
      line: { productKey: 'product-4', quantity: 10 },
      orderNumber: 'SO-2026-1005',
      status: 'FULFILLED',
      timeOffsetMinutes: 12 * 60,
    },
    {
      createdByUserId: staffUserId,
      customerKey: 'customer-2',
      key: 'order-cancelled-1',
      line: { productKey: 'product-6', quantity: 2 },
      orderNumber: 'SO-2026-1006',
      status: 'CANCELLED',
      timeOffsetMinutes: 6 * 60,
    },
  ];

  const orderIds = new Map<string, string>();
  for (const orderFixture of orders) {
    const orderId = fixtureId(organizationId, orderFixture.key);
    orderIds.set(orderFixture.key, orderId);
    const customerId = customers.get(orderFixture.customerKey);
    const product = productFixtures.find(
      (item) => item.key === orderFixture.line.productKey,
    );
    const productId = products.get(orderFixture.line.productKey);
    if (!customerId || !product || !productId)
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
        createdByUserId: orderFixture.createdByUserId,
        customerCompanyName:
          customerFixtures.find((item) => item.key === orderFixture.customerKey)
            ?.companyName ?? 'Demo Customer',
        customerContactName:
          customerFixtures.find((item) => item.key === orderFixture.customerKey)
            ?.contactName ?? null,
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

  const fulfilledSaleMovements = [
    {
      orderKey: 'order-fulfilled-1',
      productKey: 'product-1',
      quantity: 5,
      onHandAfter: 20,
    },
    {
      orderKey: 'order-fulfilled-2',
      productKey: 'product-4',
      quantity: 10,
      onHandAfter: 40,
    },
  ];
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
