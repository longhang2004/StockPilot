import { BadRequestException } from '@nestjs/common';
import { ProductInputSchema, type ProductInput } from '@stockpilot/contracts';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 5_000;
export const REQUIRED_HEADERS = ['sku', 'name', 'sale_price', 'reorder_point'];

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ParsedImport {
  errors: ImportError[];
  rows: ProductInput[];
  rowsTotal: number;
  rowsTotalForProduct: (row: ProductInput) => number;
}

export function parseProductCsv(content: string): ParsedImport {
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
  if (quoted) {
    throw new BadRequestException('CSV contains an unterminated quoted field.');
  }
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
