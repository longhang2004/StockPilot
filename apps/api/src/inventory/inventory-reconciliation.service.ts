import { Inject, Injectable } from '@nestjs/common';

import { JobRunnerService } from '../jobs/job-runner.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { TenantDatabase } from '../database/tenant-database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { reconcileLowStockTransition } from './inventory-projection.js';

export interface ReconcileBalanceInput {
  available: number;
  organizationId: string;
  productId: string;
  reorderPoint: number;
  warehouseId: string;
}

export interface ReconciliationResult {
  opened: number;
  resolved: number;
  scanned: number;
}

interface ReconciliationBalanceRow {
  available: number;
  organization_id: string;
  product_id: string;
  reorder_point: number;
  warehouse_id: string;
}

@Injectable()
export class InventoryReconciliationService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobRunnerService) jobs: JobRunnerService,
  ) {
    jobs.registerInventoryReconcileHandler(async () => {
      await this.reconcileAllOrganizations();
    });
  }

  async reconcileBalance(
    transaction: Prisma.TransactionClient,
    input: ReconcileBalanceInput,
  ): Promise<'NONE' | 'OPEN' | 'RESOLVE'> {
    const openAlert = await transaction.lowStockAlert.findFirst({
      select: { id: true },
      where: {
        organizationId: input.organizationId,
        productId: input.productId,
        status: 'OPEN',
        warehouseId: input.warehouseId,
      },
    });
    const transition = reconcileLowStockTransition(
      input.available,
      input.reorderPoint,
      Boolean(openAlert),
    );

    if (transition === 'OPEN') {
      await transaction.lowStockAlert.create({
        data: {
          availableAtOpen: input.available,
          organizationId: input.organizationId,
          productId: input.productId,
          reorderPoint: input.reorderPoint,
          warehouseId: input.warehouseId,
        },
      });
    }
    if (transition === 'RESOLVE') {
      await transaction.lowStockAlert.updateMany({
        data: { resolvedAt: new Date(), status: 'RESOLVED' },
        where: {
          organizationId: input.organizationId,
          productId: input.productId,
          status: 'OPEN',
          warehouseId: input.warehouseId,
        },
      });
    }
    return transition;
  }

  async reconcileOrganization(
    organizationId: string,
    actorId?: string,
  ): Promise<ReconciliationResult> {
    return this.database.withTenant(
      { ...(actorId ? { actorId } : {}), organizationId },
      async (transaction) => {
        const rows = await transaction.$queryRaw<ReconciliationBalanceRow[]>`
          SELECT
            ib."on_hand" - ib."reserved" AS available,
            ib."organization_id",
            ib."product_id",
            p."reorder_point",
            ib."warehouse_id"
          FROM "inventory_balances" ib
          INNER JOIN "products" p
            ON p."organization_id" = ib."organization_id"
           AND p."id" = ib."product_id"
          WHERE ib."organization_id" = ${organizationId}::uuid
          ORDER BY ib."product_id", ib."warehouse_id"
          FOR UPDATE OF ib
        `;
        const result: ReconciliationResult = {
          opened: 0,
          resolved: 0,
          scanned: rows.length,
        };
        for (const row of rows) {
          const transition = await this.reconcileBalance(transaction, {
            available: row.available,
            organizationId: row.organization_id,
            productId: row.product_id,
            reorderPoint: row.reorder_point,
            warehouseId: row.warehouse_id,
          });
          if (transition === 'OPEN') result.opened += 1;
          if (transition === 'RESOLVE') result.resolved += 1;
        }
        return result;
      },
    );
  }

  async reconcileAllOrganizations(): Promise<ReconciliationResult> {
    const organizations = await this.prisma.organization.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const total: ReconciliationResult = { opened: 0, resolved: 0, scanned: 0 };
    for (const organization of organizations) {
      const result = await this.reconcileOrganization(organization.id);
      total.opened += result.opened;
      total.resolved += result.resolved;
      total.scanned += result.scanned;
    }
    return total;
  }
}
