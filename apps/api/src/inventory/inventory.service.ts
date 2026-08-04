import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  InventoryAdjustmentInput,
  ReceiptInput,
} from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { TenantDatabase } from '../database/tenant-database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import {
  InventoryInvariantError,
  projectInventory,
} from './inventory-projection.js';
import { InventoryReconciliationService } from './inventory-reconciliation.service.js';

export interface InventoryListQuery {
  page: number;
  pageSize: number;
}

export type AlertStatusFilter = 'OPEN' | 'RESOLVED';

interface LockedBalance {
  id: string;
  onHand: number;
  reserved: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(InventoryReconciliationService)
    private readonly reconciliation: InventoryReconciliationService,
  ) {}

  applyReceipt(auth: AuthContext, input: ReceiptInput, idempotencyKey: string) {
    const organizationId = auth.membership.organization.id;
    return this.database
      .withTenant(
        { actorId: auth.user.id, organizationId },
        async (transaction) =>
          executeIdempotent(transaction, {
            key: idempotencyKey,
            organizationId,
            payload: input,
            responseStatus: 201,
            scope: 'receipt:create',
            work: () =>
              this.applyReceiptTransaction(
                transaction,
                auth,
                organizationId,
                input,
              ),
          }),
      )
      .then((result) => result.body);
  }

  adjust(
    auth: AuthContext,
    input: InventoryAdjustmentInput,
    idempotencyKey: string,
  ) {
    const organizationId = auth.membership.organization.id;
    return this.database
      .withTenant(
        { actorId: auth.user.id, organizationId },
        async (transaction) =>
          executeIdempotent(transaction, {
            key: idempotencyKey,
            organizationId,
            payload: input,
            responseStatus: 201,
            scope: 'inventory:adjustment',
            work: () =>
              this.adjustTransaction(transaction, auth, organizationId, input),
          }),
      )
      .then((result) => result.body);
  }

  listBalances(auth: AuthContext, query: InventoryListQuery) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
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
      },
    );
  }

  listMovements(auth: AuthContext, query: InventoryListQuery) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
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
      },
    );
  }

  listAlerts(
    auth: AuthContext,
    query: InventoryListQuery & { status: AlertStatusFilter },
  ) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
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
      },
    );
  }

  private async applyReceiptTransaction(
    transaction: Prisma.TransactionClient,
    auth: AuthContext,
    organizationId: string,
    input: ReceiptInput,
  ) {
    const warehouse = await transaction.warehouse.findUnique({
      where: { organizationId },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found.');
    }
    const supplier = await transaction.supplier.findFirst({
      select: { id: true },
      where: { id: input.supplierId, isActive: true, organizationId },
    });
    if (!supplier) {
      throw new NotFoundException('Active supplier not found.');
    }

    const productIds = input.lines.map((line) => line.productId).sort();
    const products = await transaction.product.findMany({
      select: { id: true, reorderPoint: true },
      where: { id: { in: productIds }, isActive: true, organizationId },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException(
        'One or more active products were not found.',
      );
    }
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    const receipt = await transaction.goodsReceipt.create({
      data: {
        actorUserId: auth.user.id,
        note: input.note,
        organizationId,
        receiptNumber: input.receiptNumber,
        receivedAt: new Date(input.receivedAt),
        supplierId: input.supplierId,
        warehouseId: warehouse.id,
      },
    });
    const lines = [];
    const balances = [];
    const beforeBalances = [];
    for (const line of [...input.lines].sort((left, right) =>
      left.productId.localeCompare(right.productId),
    )) {
      const product = productsById.get(line.productId);
      if (!product) {
        throw new NotFoundException('Active product not found.');
      }
      const current = await this.lockBalance(
        transaction,
        organizationId,
        warehouse.id,
        line.productId,
      );
      beforeBalances.push({
        available: current.onHand - current.reserved,
        onHand: current.onHand,
        productId: line.productId,
        reserved: current.reserved,
      });
      const next = projectInventory(current, {
        onHandDelta: line.quantity,
      });
      const balance = await transaction.inventoryBalance.update({
        data: { onHand: next.onHand, version: { increment: 1 } },
        where: { id: current.id },
      });
      const receiptLine = await transaction.goodsReceiptLine.create({
        data: {
          goodsReceiptId: receipt.id,
          organizationId,
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        },
      });
      await transaction.stockMovement.create({
        data: {
          actorUserId: auth.user.id,
          onHandAfter: next.onHand,
          organizationId,
          productId: line.productId,
          quantityDelta: line.quantity,
          referenceId: receipt.id,
          referenceType: 'GOODS_RECEIPT',
          type: 'RECEIPT',
          warehouseId: warehouse.id,
        },
      });
      await this.reconciliation.reconcileBalance(transaction, {
        available: next.available,
        organizationId,
        productId: line.productId,
        reorderPoint: product.reorderPoint,
        warehouseId: warehouse.id,
      });
      lines.push({
        ...receiptLine,
        unitCost: receiptLine.unitCost?.toFixed(2) ?? null,
      });
      balances.push({
        available: next.available,
        onHand: balance.onHand,
        productId: balance.productId,
        reserved: balance.reserved,
      });
    }

    await recordAudit(transaction, {
      action: 'RECEIPT_APPLIED',
      actorUserId: auth.user.id,
      after: {
        balances,
        lines,
        receiptNumber: receipt.receiptNumber,
      },
      before: { balances: beforeBalances },
      entityId: receipt.id,
      entityType: 'GoodsReceipt',
      organizationId,
    });

    return {
      ...receipt,
      balances,
      lines,
    };
  }

  private async adjustTransaction(
    transaction: Prisma.TransactionClient,
    auth: AuthContext,
    organizationId: string,
    input: InventoryAdjustmentInput,
  ) {
    const [warehouse, product] = await Promise.all([
      transaction.warehouse.findUnique({ where: { organizationId } }),
      transaction.product.findFirst({
        select: { id: true, reorderPoint: true },
        where: { id: input.productId, isActive: true, organizationId },
      }),
    ]);
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found.');
    }
    if (!product) {
      throw new NotFoundException('Active product not found.');
    }

    const current = await this.lockBalance(
      transaction,
      organizationId,
      warehouse.id,
      product.id,
    );
    const quantityDelta =
      input.type === 'ADJUSTMENT_IN' ? input.quantity : -input.quantity;
    let next;
    try {
      next = projectInventory(current, { onHandDelta: quantityDelta });
    } catch (error) {
      if (error instanceof InventoryInvariantError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    const movementId = randomUUID();
    const beforeBalance = {
      available: current.onHand - current.reserved,
      onHand: current.onHand,
      productId: product.id,
      reserved: current.reserved,
    };
    const balance = await transaction.inventoryBalance.update({
      data: { onHand: next.onHand, version: { increment: 1 } },
      where: { id: current.id },
    });
    const movement = await transaction.stockMovement.create({
      data: {
        actorUserId: auth.user.id,
        id: movementId,
        onHandAfter: next.onHand,
        organizationId,
        productId: product.id,
        quantityDelta,
        reason: input.reason,
        referenceId: movementId,
        referenceType: 'INVENTORY_ADJUSTMENT',
        type: input.type,
        warehouseId: warehouse.id,
      },
    });
    await this.reconciliation.reconcileBalance(transaction, {
      available: next.available,
      organizationId,
      productId: product.id,
      reorderPoint: product.reorderPoint,
      warehouseId: warehouse.id,
    });

    await recordAudit(transaction, {
      action: 'INVENTORY_ADJUSTED',
      actorUserId: auth.user.id,
      after: {
        balance: {
          available: next.available,
          onHand: balance.onHand,
          productId: balance.productId,
          reserved: balance.reserved,
        },
        movementId,
        type: input.type,
      },
      before: { balance: beforeBalance },
      entityId: movement.id,
      entityType: 'StockMovement',
      organizationId,
    });

    return {
      balance: {
        available: next.available,
        onHand: balance.onHand,
        productId: balance.productId,
        reserved: balance.reserved,
      },
      movement,
    };
  }

  private async lockBalance(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    warehouseId: string,
    productId: string,
  ): Promise<LockedBalance> {
    await transaction.inventoryBalance.upsert({
      create: { organizationId, productId, warehouseId },
      update: {},
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          productId,
          warehouseId,
        },
      },
    });
    const rows = await transaction.$queryRaw<
      Array<{
        id: string;
        on_hand: number;
        reserved: number;
      }>
    >`
      SELECT "id", "on_hand", "reserved"
      FROM "inventory_balances"
      WHERE "organization_id" = ${organizationId}::uuid
        AND "warehouse_id" = ${warehouseId}::uuid
        AND "product_id" = ${productId}::uuid
      FOR UPDATE
    `;
    const balance = rows[0];
    if (!balance) {
      throw new ConflictException('Inventory balance could not be locked.');
    }
    return {
      id: balance.id,
      onHand: balance.on_hand,
      reserved: balance.reserved,
    };
  }
}

function page<T>(items: T[], total: number, query: InventoryListQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}
