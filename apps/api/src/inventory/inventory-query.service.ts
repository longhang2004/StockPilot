import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  AlertStatusFilter,
  InventoryListQuery,
  MovementListQuery,
  ProductTraceQuery,
  ReceiptListQuery,
} from './inventory.types.js';

export function page<T>(items: T[], total: number, query: InventoryListQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function listBalances(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: InventoryListQuery,
) {
  const where = { organizationId, ...productSearch(query.search) };
  const [items, total] = await Promise.all([
    transaction.inventoryBalance.findMany({
      include: { product: { select: { name: true, sku: true } } },
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.inventoryBalance.count({ where }),
  ]);
  return page(
    items.map((balance) => ({
      available: balance.onHand - balance.reserved,
      id: balance.id,
      onHand: balance.onHand,
      product: balance.product,
      productId: balance.productId,
      reserved: balance.reserved,
      updatedAt: balance.updatedAt,
      warehouseId: balance.warehouseId,
    })),
    total,
    query,
  );
}

export async function listMovements(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: MovementListQuery,
) {
  const where = {
    organizationId,
    ...productSearch(query.search),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.type ? { type: query.type } : {}),
  };
  const [items, total] = await Promise.all([
    transaction.stockMovement.findMany({
      include: { product: { select: { name: true, sku: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.stockMovement.count({ where }),
  ]);
  return page(items, total, query);
}

export async function listReceipts(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: ReceiptListQuery,
) {
  const where: Prisma.GoodsReceiptWhereInput = {
    organizationId,
    ...(query.search
      ? {
          OR: [
            {
              receiptNumber: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            {
              supplier: {
                companyName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    transaction.goodsReceipt.findMany({
      include: {
        _count: { select: { lines: true } },
        supplier: { select: { companyName: true, id: true } },
      },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.goodsReceipt.count({ where }),
  ]);
  const quantities = items.length
    ? await transaction.goodsReceiptLine.groupBy({
        by: ['goodsReceiptId'],
        _sum: { quantity: true },
        where: {
          goodsReceiptId: { in: items.map((receipt) => receipt.id) },
          organizationId,
        },
      })
    : [];
  const quantityByReceipt = new Map(
    quantities.map((row) => [row.goodsReceiptId, row._sum.quantity ?? 0]),
  );
  return page(
    items.map((receipt) => ({
      actorUserId: receipt.actorUserId,
      createdAt: receipt.createdAt.toISOString(),
      id: receipt.id,
      lineCount: receipt._count.lines,
      note: receipt.note,
      organizationId: receipt.organizationId,
      receiptNumber: receipt.receiptNumber,
      receivedAt: receipt.receivedAt.toISOString(),
      supplier: receipt.supplier,
      supplierId: receipt.supplierId,
      totalQuantity: quantityByReceipt.get(receipt.id) ?? 0,
      warehouseId: receipt.warehouseId,
    })),
    total,
    query,
  );
}

export async function findReceiptDetail(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  id: string,
) {
  const receipt = await transaction.goodsReceipt.findFirst({
    include: {
      lines: {
        include: { product: { select: { name: true, sku: true } } },
        orderBy: [{ id: 'asc' }],
      },
      supplier: { select: { companyName: true, id: true } },
    },
    where: { id, organizationId },
  });
  if (!receipt) throw new NotFoundException('Goods receipt not found.');
  return {
    actorUserId: receipt.actorUserId,
    createdAt: receipt.createdAt.toISOString(),
    id: receipt.id,
    lineCount: receipt.lines.length,
    lines: receipt.lines.map((line) => ({
      goodsReceiptId: line.goodsReceiptId,
      id: line.id,
      product: line.product,
      productId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost?.toFixed(2) ?? null,
    })),
    note: receipt.note,
    organizationId: receipt.organizationId,
    receiptNumber: receipt.receiptNumber,
    receivedAt: receipt.receivedAt.toISOString(),
    supplier: receipt.supplier,
    supplierId: receipt.supplierId,
    totalQuantity: receipt.lines.reduce((sum, line) => sum + line.quantity, 0),
    warehouseId: receipt.warehouseId,
  };
}

export async function findProductTrace(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  productId: string,
  query: ProductTraceQuery,
) {
  const product = await transaction.product.findFirst({
    select: { id: true, name: true, reorderPoint: true, sku: true },
    where: { id: productId, organizationId },
  });
  if (!product) throw new NotFoundException('Product not found.');
  const warehouse = await transaction.warehouse.findUnique({
    where: { organizationId },
  });
  const [balance, reservations, reservationCount, movements] =
    await Promise.all([
      warehouse
        ? transaction.inventoryBalance.findFirst({
            select: {
              onHand: true,
              reserved: true,
              updatedAt: true,
              warehouseId: true,
            },
            where: { organizationId, productId, warehouseId: warehouse.id },
          })
        : null,
      warehouse
        ? transaction.salesOrderLine.findMany({
            include: {
              salesOrder: {
                select: {
                  confirmedAt: true,
                  customerCompanyName: true,
                  id: true,
                  orderNumber: true,
                },
              },
            },
            orderBy: [
              { salesOrder: { confirmedAt: 'desc' } },
              { salesOrderId: 'asc' },
              { id: 'asc' },
            ],
            skip: (query.reservationsPage - 1) * query.reservationsPageSize,
            take: query.reservationsPageSize,
            where: {
              organizationId,
              productId,
              salesOrder: {
                is: {
                  organizationId,
                  status: 'CONFIRMED',
                  warehouseId: warehouse.id,
                },
              },
            },
          })
        : [],
      warehouse
        ? transaction.salesOrderLine.count({
            where: {
              organizationId,
              productId,
              salesOrder: {
                is: {
                  organizationId,
                  status: 'CONFIRMED',
                  warehouseId: warehouse.id,
                },
              },
            },
          })
        : 0,
      listMovements(transaction, organizationId, {
        page: query.movementsPage,
        pageSize: query.movementsPageSize,
        productId,
      }),
    ]);
  return {
    balance: balance
      ? {
          available: balance.onHand - balance.reserved,
          onHand: balance.onHand,
          reserved: balance.reserved,
          updatedAt: balance.updatedAt.toISOString(),
          warehouseId: balance.warehouseId,
        }
      : null,
    movements,
    product,
    reservations: page(
      reservations.map((line) => ({
        confirmedAt: line.salesOrder.confirmedAt?.toISOString() ?? null,
        customerCompanyName: line.salesOrder.customerCompanyName,
        id: line.id,
        orderId: line.salesOrder.id,
        orderNumber: line.salesOrder.orderNumber,
        quantity: line.quantity,
      })),
      reservationCount,
      {
        page: query.reservationsPage,
        pageSize: query.reservationsPageSize,
      },
    ),
  };
}

export async function listAlerts(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  query: InventoryListQuery & { status: AlertStatusFilter },
) {
  const where = {
    organizationId,
    status: query.status,
    ...productSearch(query.search),
  };
  const [items, total] = await Promise.all([
    transaction.lowStockAlert.findMany({
      include: { product: { select: { name: true, sku: true } } },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    }),
    transaction.lowStockAlert.count({ where }),
  ]);
  return page(items, total, query);
}

export async function inventorySummary(
  transaction: Prisma.TransactionClient,
  organizationId: string,
) {
  const [balances, openAlerts] = await Promise.all([
    transaction.inventoryBalance.aggregate({
      where: { organizationId },
      _count: true,
      _sum: { onHand: true, reserved: true },
    }),
    transaction.lowStockAlert.count({
      where: { organizationId, status: 'OPEN' },
    }),
  ]);
  return {
    trackedSkus: balances._count,
    availableUnits: (balances._sum.onHand ?? 0) - (balances._sum.reserved ?? 0),
    openAlerts,
  };
}

function productSearch(search?: string) {
  return search
    ? {
        product: {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      }
    : {};
}
