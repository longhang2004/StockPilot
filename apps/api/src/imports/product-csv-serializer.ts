import type { Prisma } from '../generated/prisma/client.js';
import type { ProductInput } from '@stockpilot/contracts';

import type { ImportError } from './product-csv-parser.js';

export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function parseValidRows(value: Prisma.JsonValue | null): ProductInput[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as ProductInput[];
}

export function parseErrors(value: Prisma.JsonValue | null): ImportError[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as ImportError[];
}

export function serializeRun(
  run: {
    id: string;
    fileName: string;
    status: string;
    rowsTotal: number;
    rowsValid: number;
    rowsInvalid: number;
    errors: Prisma.JsonValue | null;
    createdAt: Date;
  },
  errors?: ImportError[],
) {
  return {
    createdAt: run.createdAt,
    errors: errors ?? parseErrors(run.errors),
    fileName: run.fileName,
    id: run.id,
    rowsInvalid: run.rowsInvalid,
    rowsTotal: run.rowsTotal,
    rowsValid: run.rowsValid,
    status: run.status,
  };
}

export async function exportProductsCsv(
  transaction: Prisma.TransactionClient,
  organizationId: string,
) {
  const products = await transaction.product.findMany({
    orderBy: [{ sku: 'asc' }, { id: 'asc' }],
    where: { organizationId },
  });
  return [
    'sku,name,sale_price,reorder_point,description,is_active',
    ...products.map((product) =>
      [
        product.sku,
        product.name,
        product.salePrice.toFixed(2),
        product.reorderPoint,
        product.description ?? '',
        product.isActive,
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');
}
