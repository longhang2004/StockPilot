import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProductInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { Prisma } from '../generated/prisma/client.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import { commitProductImport } from './product-import-commit.service.js';
import {
  parseErrors,
  serializeRun,
  csvCell,
  exportProductsCsv,
} from './product-csv-serializer.js';
import { parseProductCsv, type ImportError } from './product-csv-parser.js';

export interface ProductImportPreviewInput {
  content: string;
  fileName: string;
}

export type { ImportError } from './product-csv-parser.js';

@Injectable()
export class ProductImportService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  preview(auth: AuthContext, input: ProductImportPreviewInput) {
    const parsed = parseProductCsv(input.content);
    return this.database.withTenant(
      {
        actorId: auth.user.id,
        organizationId: auth.membership.organization.id,
      },
      async (transaction) => {
        const organizationId = auth.membership.organization.id;
        const existing = await transaction.product.findMany({
          select: { sku: true },
          where: { organizationId },
        });
        const existingSkus = new Set(existing.map((product) => product.sku));
        const errors = [...parsed.errors];
        const validRows: ProductInput[] = [];
        const seenSkus = new Set<string>();
        for (const row of parsed.rows) {
          const sku = row.sku.toUpperCase();
          if (existingSkus.has(sku)) {
            errors.push({
              field: 'sku',
              message: 'SKU already exists in this organization.',
              row: parsed.rowsTotalForProduct(row),
            });
            continue;
          }
          if (seenSkus.has(sku)) {
            errors.push({
              field: 'sku',
              message: 'SKU appears more than once in this file.',
              row: parsed.rowsTotalForProduct(row),
            });
            continue;
          }
          seenSkus.add(sku);
          validRows.push(row);
        }
        const run = await transaction.productImportRun.create({
          data: {
            createdByUserId: auth.user.id,
            errors:
              errors.length > 0
                ? (errors as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            fileName: input.fileName.trim().slice(0, 255),
            organizationId,
            rowsInvalid: parsed.rowsTotal - validRows.length,
            rowsTotal: parsed.rowsTotal,
            rowsValid: validRows.length,
            status: 'PREVIEW',
            validRows: validRows as unknown as Prisma.InputJsonValue,
          },
        });
        await recordAudit(transaction, {
          action: 'PRODUCT_IMPORT_PREVIEWED',
          actorUserId: auth.user.id,
          after: {
            rowsInvalid: parsed.rowsTotal - validRows.length,
            rowsTotal: parsed.rowsTotal,
            rowsValid: validRows.length,
          },
          entityId: run.id,
          entityType: 'ProductImportRun',
          organizationId,
        });
        return serializeRun(run, errors);
      },
    );
  }

  commit(auth: AuthContext, id: string, idempotencyKey: string) {
    const organizationId = auth.membership.organization.id;
    return this.database
      .withTenant(
        { actorId: auth.user.id, organizationId },
        async (transaction) =>
          executeIdempotent(transaction, {
            key: idempotencyKey,
            organizationId,
            payload: { id },
            responseStatus: 200,
            scope: 'product-import:commit',
            work: () =>
              commitProductImport(transaction, auth, organizationId, id),
          }),
      )
      .then((result) => result.body);
  }

  errorsCsv(auth: AuthContext, id: string) {
    return this.database.withTenant(
      {
        actorId: auth.user.id,
        organizationId: auth.membership.organization.id,
      },
      async (transaction) => {
        const run = await transaction.productImportRun.findFirst({
          where: { id, organizationId: auth.membership.organization.id },
        });
        if (!run) throw new NotFoundException('Product import not found.');
        const errors = parseErrors(run.errors);
        return [
          'row,field,message',
          ...errors.map((error: ImportError) =>
            [error.row, error.field ?? '', error.message]
              .map(csvCell)
              .join(','),
          ),
        ].join('\n');
      },
    );
  }

  exportProducts(auth: AuthContext) {
    return this.database.withTenant(
      {
        actorId: auth.user.id,
        organizationId: auth.membership.organization.id,
      },
      (transaction) =>
        exportProductsCsv(transaction, auth.membership.organization.id),
    );
  }
}
