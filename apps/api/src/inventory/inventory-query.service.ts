import type { Prisma } from '../generated/prisma/client.js';
import type {
  AlertStatusFilter,
  InventoryListQuery,
  MovementListQuery,
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
