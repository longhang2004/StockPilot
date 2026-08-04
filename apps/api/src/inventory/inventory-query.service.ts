import type { Prisma } from '../generated/prisma/client.js';
import type {
  AlertStatusFilter,
  InventoryListQuery,
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
  const where = { organizationId };
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
  query: InventoryListQuery,
) {
  const where = { organizationId };
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
  const where = { organizationId, status: query.status };
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
