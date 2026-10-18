import { Inject, Injectable } from '@nestjs/common';
import type {
  InventoryAdjustmentInput,
  ReceiptInput,
} from '@stockpilot/contracts';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import {
  TenantDatabase,
  type TenantTransactionOptions,
} from '../database/tenant-database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import { adjustTransaction } from './adjustment-command.service.js';
import { applyReceiptTransaction } from './receipt-command.service.js';
import { InventoryReconciliationService } from './inventory-reconciliation.service.js';
import {
  listAlerts,
  listBalances,
  listMovements,
  inventorySummary,
  listReceipts,
  findReceiptDetail,
  findProductTrace,
} from './inventory-query.service.js';
import type {
  AlertStatusFilter,
  InventoryListQuery,
  MovementListQuery,
  ProductTraceQuery,
  ReceiptListQuery,
} from './inventory.types.js';

export type {
  AlertStatusFilter,
  InventoryListQuery,
} from './inventory.types.js';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(InventoryReconciliationService)
    private readonly reconciliation: InventoryReconciliationService,
  ) {}

  applyReceipt(auth: AuthContext, input: ReceiptInput, idempotencyKey: string) {
    const organizationId = requireMembership(auth).organization.id;
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
              applyReceiptTransaction(
                transaction,
                this.reconciliation,
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
    const organizationId = requireMembership(auth).organization.id;
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
              adjustTransaction(
                transaction,
                this.reconciliation,
                auth,
                organizationId,
                input,
              ),
          }),
      )
      .then((result) => result.body);
  }

  listBalances(auth: AuthContext, query: InventoryListQuery) {
    return this.inTenant(auth, (transaction, organizationId) =>
      listBalances(transaction, organizationId, query),
    );
  }

  listMovements(auth: AuthContext, query: MovementListQuery) {
    return this.inTenant(auth, (transaction, organizationId) =>
      listMovements(transaction, organizationId, query),
    );
  }

  summary(auth: AuthContext) {
    return this.inTenant(auth, (transaction, organizationId) =>
      inventorySummary(transaction, organizationId),
    );
  }

  listAlerts(
    auth: AuthContext,
    query: InventoryListQuery & { status: AlertStatusFilter },
  ) {
    return this.inTenant(auth, (transaction, organizationId) =>
      listAlerts(transaction, organizationId, query),
    );
  }

  listReceipts(auth: AuthContext, query: ReceiptListQuery) {
    return this.inTenant(auth, (transaction, organizationId) =>
      listReceipts(transaction, organizationId, query),
    );
  }

  getReceipt(auth: AuthContext, id: string) {
    return this.inTenant(auth, (transaction, organizationId) =>
      findReceiptDetail(transaction, organizationId, id),
    );
  }

  productTrace(auth: AuthContext, productId: string, query: ProductTraceQuery) {
    return this.inTenant(
      auth,
      (transaction, organizationId) =>
        findProductTrace(transaction, organizationId, productId, query),
      { isolationLevel: 'RepeatableRead' },
    );
  }

  private inTenant<T>(
    auth: AuthContext,
    work: (
      transaction: Prisma.TransactionClient,
      organizationId: string,
    ) => Promise<T>,
    options?: TenantTransactionOptions,
  ) {
    const organizationId = requireMembership(auth).organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) => work(transaction, organizationId),
      options,
    );
  }
}
