import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductInputSchema, type ProductInput } from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { Prisma } from '../generated/prisma/client.js';
import { executeIdempotent } from '../idempotency/idempotency.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5_000;
const REQUIRED_HEADERS = ['sku', 'name', 'sale_price', 'reorder_point'];

export interface ProductImportPreviewInput {
  content: string;
  fileName: string;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

interface ParsedImport {
  errors: ImportError[];
  rows: ProductInput[];
  rowsTotal: number;
}

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
            work: async () => {
              const run = await transaction.productImportRun.findFirst({
                where: { id, organizationId },
              });
              if (!run)
                throw new NotFoundException('Product import not found.');
              if (run.status !== 'PREVIEW') {
                throw new ConflictException(
                  'This import has already been committed.',
                );
              }
              const rows = parseValidRows(run.validRows);
              let created = 0;
              for (const row of rows) {
                await transaction.product.create({
                  data: { ...row, organizationId },
                });
                created += 1;
              }
              const updated = await transaction.productImportRun.update({
                data: { status: 'COMMITTED' },
                where: { id },
              });
              await recordAudit(transaction, {
                action: 'PRODUCT_IMPORT_COMMITTED',
                actorUserId: auth.user.id,
                after: { created, importId: id },
                entityId: id,
                entityType: 'ProductImportRun',
                organizationId,
              });
              return { created, run: serializeRun(updated) };
            },
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
          ...errors.map((error) =>
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
      async (transaction) => {
        const products = await transaction.product.findMany({
          orderBy: [{ sku: 'asc' }, { id: 'asc' }],
          where: { organizationId: auth.membership.organization.id },
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
      },
    );
  }
}

function parseProductCsv(content: string): ParsedImport & {
  rowsTotalForProduct: (row: ProductInput) => number;
} {
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
    throw new BadRequestException('CSV file exceeds the 2 MB limit.');
  }
  const records = parseCsv(content);
  if (records.length === 0) {
    throw new BadRequestException('CSV file must include a header row.');
  }
  const headers = records[0]!.map((value) => normalizeHeader(value));
  const missing = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missing.length > 0) {
    throw new BadRequestException(
      `Missing required CSV columns: ${missing.join(', ')}.`,
    );
  }
  const dataRecords = records
    .slice(1)
    .filter((record) => record.some((value) => value.trim().length > 0));
  if (dataRecords.length > MAX_ROWS) {
    throw new BadRequestException('CSV file exceeds the 5,000 row limit.');
  }
  const errors: ImportError[] = [];
  const rows: ProductInput[] = [];
  const sourceRowByProduct = new WeakMap<object, number>();
  dataRecords.forEach((record, index) => {
    const rowNumber = index + 2;
    if (record.length > headers.length) {
      errors.push({ message: 'Too many columns in row.', row: rowNumber });
      return;
    }
    const raw = Object.fromEntries(
      headers.map((header, column) => [header, record[column]?.trim() ?? '']),
    );
    const parsed = ProductInputSchema.safeParse({
      description: raw.description || null,
      name: raw.name,
      reorderPoint: raw.reorder_point === '' ? NaN : Number(raw.reorder_point),
      salePrice: raw.sale_price,
      sku: raw.sku,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = csvField(issue.path[0]);
        errors.push(
          field
            ? { field, message: issue.message, row: rowNumber }
            : { message: issue.message, row: rowNumber },
        );
      }
      return;
    }
    sourceRowByProduct.set(parsed.data as unknown as object, rowNumber);
    rows.push(parsed.data);
  });
  return {
    errors,
    rows,
    rowsTotal: dataRecords.length,
    rowsTotalForProduct: (row) =>
      sourceRowByProduct.get(row as unknown as object) ?? 0,
  };
}

function parseCsv(content: string): string[][] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (quoted) {
      if (character === '"' && normalized[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted)
    throw new BadRequestException('CSV contains an unterminated quoted field.');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  return records;
}

function normalizeHeader(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'saleprice') return 'sale_price';
  if (normalized === 'reorderpoint') return 'reorder_point';
  return normalized;
}

function csvField(value: PropertyKey | undefined): string | undefined {
  if (value === undefined) return undefined;
  const field = String(value);
  return field === 'salePrice'
    ? 'sale_price'
    : field === 'reorderPoint'
      ? 'reorder_point'
      : field;
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseValidRows(value: Prisma.JsonValue | null): ProductInput[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as ProductInput[];
}

function parseErrors(value: Prisma.JsonValue | null): ImportError[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as ImportError[];
}

function serializeRun(
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
