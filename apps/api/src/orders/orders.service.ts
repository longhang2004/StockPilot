import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SalesOrderInput, OrderStatus } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { TenantDatabase } from '../database/tenant-database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import {
  InventoryInvariantError,
  projectInventory,
} from '../inventory/inventory-projection.js';
import { InventoryReconciliationService } from '../inventory/inventory-reconciliation.service.js';
import {
  canTransition,
  invalidTransitionMessage,
} from './order-state-machine.js';

export interface OrderListQuery {
  page: number;
  pageSize: number;
  search: string;
  status?: OrderStatus | undefined;
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(InventoryReconciliationService)
    private readonly reconciliation: InventoryReconciliationService,
  ) {}

  create(auth: AuthContext, input: SalesOrderInput) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
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
        if (!warehouse) {
          throw new NotFoundException('Warehouse not found.');
        }
        if (!customer) {
          throw new NotFoundException('Active customer not found.');
        }
        if (products.length !== input.lines.length) {
          throw new NotFoundException(
            'One or more active products were not found.',
          );
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
        for (const line of input.lines) {
          const product = productsById.get(line.productId);
          if (!product) {
            throw new NotFoundException('Active product not found.');
          }
          await transaction.salesOrderLine.create({
            data: {
              lineTotal: (Number(product.salePrice) * line.quantity).toFixed(2),
              organizationId,
              productId: product.id,
              productNameSnapshot: product.name,
              quantity: line.quantity,
              salesOrderId: order.id,
              skuSnapshot: product.sku,
              unitPrice: product.salePrice,
            },
          });
        }
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
        return this.findDetail(transaction, organizationId, order.id);
      },
    );
  }

  list(auth: AuthContext, query: OrderListQuery) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const where: Prisma.SalesOrderWhereInput = { organizationId };
        if (query.status) where.status = query.status;
        if (query.search) {
          where.OR = [
            { orderNumber: { contains: query.search, mode: 'insensitive' } },
            {
              customerCompanyName: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          ];
        }
        const [items, total] = await Promise.all([
          transaction.salesOrder.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          transaction.salesOrder.count({ where }),
        ]);
        return page(items.map(serializeOrder), total, query);
      },
    );
  }

  get(auth: AuthContext, id: string) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) => this.findDetail(transaction, organizationId, id),
    );
  }

  updateDraft(auth: AuthContext, id: string, input: SalesOrderInput) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const existing = await transaction.salesOrder.findFirst({
          where: { id, organizationId },
        });
        if (!existing) throw new NotFoundException('Sales order not found.');
        if (existing.status !== 'DRAFT') {
          throw new ConflictException('Only Draft orders can be edited.');
        }
        await transaction.salesOrderLine.deleteMany({
          where: { organizationId, salesOrderId: id },
        });
        const replacement = await this.createDraftLines(
          transaction,
          organizationId,
          id,
          input,
        );
        await transaction.salesOrder.update({
          data: {
            customerCompanyName: replacement.customer.companyName,
            customerContactName: replacement.customer.contactName,
            customerEmail: replacement.customer.email,
            customerId: replacement.customer.id,
            note: input.note,
            subtotal: replacement.subtotal.toFixed(2),
          },
          where: { id },
        });
        await recordAudit(transaction, {
          action: 'ORDER_UPDATED',
          actorUserId: auth.user.id,
          after: { orderId: id, subtotal: replacement.subtotal.toFixed(2) },
          before: {
            orderId: existing.id,
            status: existing.status,
            subtotal: existing.subtotal.toFixed(2),
          },
          entityId: id,
          entityType: 'SalesOrder',
          organizationId,
        });
        return this.findDetail(transaction, organizationId, id);
      },
    );
  }

  transition(
    auth: AuthContext,
    id: string,
    to: Exclude<OrderStatus, 'DRAFT'>,
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
            payload: { id, to },
            responseStatus: 200,
            scope: `order:transition:${to.toLowerCase()}`,
            work: () => this.transitionTransaction(transaction, auth, id, to),
          }),
      )
      .then((result) => result.body);
  }

  private async transitionTransaction(
    transaction: Prisma.TransactionClient,
    auth: AuthContext,
    id: string,
    to: Exclude<OrderStatus, 'DRAFT'>,
  ) {
    const locked = await transaction.$queryRaw<
      Array<{ id: string; status: OrderStatus }>
    >`
      SELECT "id", "status"::text
      FROM "sales_orders"
      WHERE "organization_id" = ${auth.membership.organization.id}::uuid
        AND "id" = ${id}::uuid
      FOR UPDATE
    `;
    const current = locked[0];
    if (!current) throw new NotFoundException('Sales order not found.');
    if (!canTransition(current.status, to)) {
      throw new ConflictException(invalidTransitionMessage(current.status, to));
    }
    const order = await transaction.salesOrder.findUnique({
      include: { lines: true },
      where: { id },
    });
    if (!order) throw new NotFoundException('Sales order not found.');

    const lines = [...order.lines].sort((left, right) =>
      left.productId.localeCompare(right.productId),
    );
    if (to === 'CONFIRMED') {
      for (const line of lines) {
        const balance = await this.lockOrderBalance(
          transaction,
          order.organizationId,
          order.warehouseId,
          line.productId,
        );
        if (balance.onHand - balance.reserved < line.quantity) {
          throw new ConflictException(
            `Insufficient available stock for ${line.skuSnapshot}.`,
          );
        }
        await transaction.inventoryBalance.update({
          data: {
            reserved: { increment: line.quantity },
            version: { increment: 1 },
          },
          where: { id: balance.id },
        });
        await this.reconciliation.reconcileBalance(transaction, {
          available: balance.onHand - balance.reserved - line.quantity,
          organizationId: order.organizationId,
          productId: line.productId,
          reorderPoint: balance.reorderPoint,
          warehouseId: order.warehouseId,
        });
      }
    }
    if (to === 'FULFILLED') {
      for (const line of lines) {
        const balance = await this.lockOrderBalance(
          transaction,
          order.organizationId,
          order.warehouseId,
          line.productId,
        );
        let next;
        try {
          next = projectInventory(balance, {
            onHandDelta: -line.quantity,
            reservedDelta: -line.quantity,
          });
        } catch (error) {
          if (error instanceof InventoryInvariantError) {
            throw new ConflictException(error.message);
          }
          throw error;
        }
        await transaction.inventoryBalance.update({
          data: {
            onHand: next.onHand,
            reserved: next.reserved,
            version: { increment: 1 },
          },
          where: { id: balance.id },
        });
        await this.reconciliation.reconcileBalance(transaction, {
          available: next.available,
          organizationId: order.organizationId,
          productId: line.productId,
          reorderPoint: balance.reorderPoint,
          warehouseId: order.warehouseId,
        });
        await transaction.stockMovement.create({
          data: {
            actorUserId: auth.user.id,
            onHandAfter: next.onHand,
            organizationId: order.organizationId,
            productId: line.productId,
            quantityDelta: -line.quantity,
            referenceId: order.id,
            referenceType: 'SALES_ORDER',
            type: 'SALE',
            warehouseId: order.warehouseId,
          },
        });
      }
    }
    if (to === 'CANCELLED' && current.status === 'CONFIRMED') {
      for (const line of lines) {
        const balance = await this.lockOrderBalance(
          transaction,
          order.organizationId,
          order.warehouseId,
          line.productId,
        );
        let next;
        try {
          next = projectInventory(balance, { reservedDelta: -line.quantity });
        } catch (error) {
          if (error instanceof InventoryInvariantError) {
            throw new ConflictException(error.message);
          }
          throw error;
        }
        await transaction.inventoryBalance.update({
          data: { reserved: next.reserved, version: { increment: 1 } },
          where: { id: balance.id },
        });
        await this.reconciliation.reconcileBalance(transaction, {
          available: next.available,
          organizationId: order.organizationId,
          productId: line.productId,
          reorderPoint: balance.reorderPoint,
          warehouseId: order.warehouseId,
        });
      }
    }

    const now = new Date();
    const updateData: Prisma.SalesOrderUpdateInput = { status: to };
    if (to === 'CANCELLED') updateData.cancelledAt = now;
    if (to === 'CONFIRMED') updateData.confirmedAt = now;
    if (to === 'FULFILLED') updateData.fulfilledAt = now;
    await transaction.salesOrder.update({
      data: updateData,
      where: { id },
    });
    await transaction.orderTransition.create({
      data: {
        actorUserId: auth.user.id,
        fromStatus: current.status,
        organizationId: order.organizationId,
        salesOrderId: order.id,
        toStatus: to,
      },
    });
    await recordAudit(transaction, {
      action: `ORDER_${to}`,
      actorUserId: auth.user.id,
      after: { fromStatus: current.status, toStatus: to },
      before: { status: current.status },
      entityId: order.id,
      entityType: 'SalesOrder',
      organizationId: order.organizationId,
    });
    return this.findDetail(transaction, order.organizationId, order.id);
  }

  private async createDraftLines(
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
    return { customer, subtotal };
  }

  private async lockOrderBalance(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    warehouseId: string,
    productId: string,
  ) {
    const rows = await transaction.$queryRaw<
      Array<{
        id: string;
        on_hand: number;
        reserved: number;
        reorder_point: number;
      }>
    >`
      SELECT ib."id", ib."on_hand", ib."reserved", p."reorder_point"
      FROM "inventory_balances" ib
      INNER JOIN "products" p
        ON p."organization_id" = ib."organization_id"
       AND p."id" = ib."product_id"
      WHERE ib."organization_id" = ${organizationId}::uuid
        AND ib."warehouse_id" = ${warehouseId}::uuid
        AND ib."product_id" = ${productId}::uuid
      FOR UPDATE OF ib
    `;
    const row = rows[0];
    if (!row) {
      throw new ConflictException(
        'No inventory balance exists for this product.',
      );
    }
    return {
      id: row.id,
      onHand: row.on_hand,
      reorderPoint: row.reorder_point,
      reserved: row.reserved,
    };
  }

  private findDetail(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ) {
    return transaction.salesOrder
      .findFirst({
        include: {
          lines: { orderBy: [{ id: 'asc' }] },
          transitions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
        where: { id, organizationId },
      })
      .then((order) => {
        if (!order) throw new NotFoundException('Sales order not found.');
        return {
          ...serializeOrder(order),
          lines: order.lines.map(serializeLine),
          transitions: order.transitions,
        };
      });
  }
}

function serializeOrder(order: {
  subtotal: { toFixed: (digits: number) => string };
  [key: string]: unknown;
}) {
  return { ...order, subtotal: order.subtotal.toFixed(2) };
}

function serializeLine(line: {
  unitPrice: { toFixed: (digits: number) => string };
  lineTotal: { toFixed: (digits: number) => string };
  [key: string]: unknown;
}) {
  return {
    ...line,
    lineTotal: line.lineTotal.toFixed(2),
    unitPrice: line.unitPrice.toFixed(2),
  };
}

function page<T>(items: T[], total: number, query: OrderListQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}
