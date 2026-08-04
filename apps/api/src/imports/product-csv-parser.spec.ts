import { describe, expect, it } from 'vitest';

describe('product CSV parser', () => {
  it('keeps source row numbers and parses quoted cells', async () => {
    const { parseProductCsv } = await import('./product-csv-parser.js');

    const parsed = parseProductCsv(
      [
        'sku,name,sale_price,reorder_point,description',
        'MILK-1,"Organic, Oat Milk",12.50,4,"1L bottle"',
        'BAD,Missing price,,nope,',
      ].join('\n'),
    );

    expect(parsed.rowsTotal).toBe(2);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      description: '1L bottle',
      name: 'Organic, Oat Milk',
      reorderPoint: 4,
      salePrice: '12.50',
      sku: 'MILK-1',
    });
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'sale_price', row: 3 }),
        expect.objectContaining({ field: 'reorder_point', row: 3 }),
      ]),
    );
  });

  it('rejects unterminated quoted fields', async () => {
    const { parseProductCsv } = await import('./product-csv-parser.js');

    expect(() =>
      parseProductCsv(
        'sku,name,sale_price,reorder_point\nSKU-1,"Broken,12.50,1',
      ),
    ).toThrow('CSV contains an unterminated quoted field.');
  });
});
