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
import { executeIdempotent } from '../idempotency/idempotency.js';
import { InventoryReconciliationService } from '../inventory/inventory-reconciliation.service.js';
import { createDraftOrder, replaceDraftLines } from './order-draft.service.js';
import { findOrderDetail, listOrders } from './order-query.service.js';
import { transitionOrder } from './order-transition.service.js';
import type { OrderListQuery } from './orders.types.js';

export type { OrderListQuery } from './orders.types.js';

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
        const order = await createDraftOrder(transaction, auth, input);
        return findOrderDetail(transaction, organizationId, order.id);
      },
    );
  }

  list(auth: AuthContext, query: OrderListQuery) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) => listOrders(transaction, organizationId, query),
    );
  }

  get(auth: AuthContext, id: string) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) => findOrderDetail(transaction, organizationId, id),
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
        const replacement = await replaceDraftLines(
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
        return findOrderDetail(transaction, organizationId, id);
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
            work: () =>
              transitionOrder(transaction, this.reconciliation, auth, id, to),
          }),
      )
      .then((result) => result.body);
  }
}
