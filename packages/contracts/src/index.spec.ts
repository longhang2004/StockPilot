import { describe, expect, it } from 'vitest';

describe('public contracts', () => {
  it('accepts only supported roles and order statuses', async () => {
    const { OrderStatusSchema, RoleSchema } = await import('./index.js');

    expect(RoleSchema.parse('MANAGER')).toBe('MANAGER');
    expect(OrderStatusSchema.parse('CONFIRMED')).toBe('CONFIRMED');
    expect(() => RoleSchema.parse('ADMIN')).toThrow();
    expect(() => OrderStatusSchema.parse('SHIPPED')).toThrow();
  });

  it('validates RFC 9457 problem details with StockPilot extensions', async () => {
    const { ProblemDetailsSchema } = await import('./index.js');

    const result = ProblemDetailsSchema.parse({
      type: 'https://stockpilot.dev/problems/validation',
      title: 'Validation failed',
      status: 400,
      detail: 'One or more fields are invalid.',
      instance: '/v1/products',
      code: 'VALIDATION_ERROR',
      traceId: 'trace-123',
      errors: [{ field: 'sku', message: 'SKU is required.' }],
    });

    expect(result.errors?.[0]?.field).toBe('sku');
  });

  it('normalizes product input and rejects invalid wholesale quantities', async () => {
    const { ProductImageSchema, ProductInputSchema } =
      await import('./index.js');

    expect(
      ProductInputSchema.parse({
        name: '  Organic Oat Milk  ',
        reorderPoint: 16,
        salePrice: '42.50',
        sku: ' oat-12 ',
      }),
    ).toEqual({
      description: null,
      name: 'Organic Oat Milk',
      reorderPoint: 16,
      salePrice: '42.50',
      sku: 'OAT-12',
    });
    expect(() =>
      ProductInputSchema.parse({
        name: 'Invalid',
        reorderPoint: -1,
        salePrice: '2.00',
        sku: 'INVALID',
      }),
    ).toThrow();
    expect(
      ProductImageSchema.parse({
        format: 'webp',
        height: 320,
        url: 'https://res.cloudinary.com/example/image.webp',
        width: 320,
      }),
    ).toMatchObject({ format: 'webp', width: 320 });
  });

  it('validates minimal B2B customer and supplier records', async () => {
    const { CustomerInputSchema, SupplierInputSchema } =
      await import('./index.js');

    expect(
      CustomerInputSchema.parse({
        companyName: ' Northstar Market ',
        contactName: 'Avery Chen',
        email: 'orders@northstar.example',
      }),
    ).toMatchObject({ companyName: 'Northstar Market', phone: null });
    expect(
      SupplierInputSchema.parse({
        companyName: 'Greenway Foods',
        email: 'supply@greenway.example',
      }),
    ).toMatchObject({ companyName: 'Greenway Foods', contactName: null });
  });

  it('validates atomic receipt and compensating adjustment inputs', async () => {
    const { InventoryAdjustmentInputSchema, ReceiptInputSchema } =
      await import('./index.js');
    const productId = '1b7c2277-2adc-4277-bdb0-f584b0f764bf';

    expect(
      ReceiptInputSchema.parse({
        lines: [{ productId, quantity: 12, unitCost: '18.50' }],
        receiptNumber: ' GR-2026-001 ',
        receivedAt: '2026-08-04T03:30:00.000Z',
        supplierId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
      }),
    ).toMatchObject({
      note: null,
      receiptNumber: 'GR-2026-001',
      lines: [{ productId, quantity: 12, unitCost: '18.50' }],
    });
    expect(() =>
      InventoryAdjustmentInputSchema.parse({
        productId,
        quantity: 0,
        reason: 'Cycle count',
        type: 'ADJUSTMENT_OUT',
      }),
    ).toThrow();
    expect(() =>
      InventoryAdjustmentInputSchema.parse({
        productId,
        quantity: 3,
        reason: ' ',
        type: 'ADJUSTMENT_OUT',
      }),
    ).toThrow();
  });

  it('validates draft sales order lines without trusting client prices', async () => {
    const { SalesOrderInputSchema } = await import('./index.js');
    const productId = '1b7c2277-2adc-4277-bdb0-f584b0f764bf';
    const customerId = 'eb3d7274-745e-48e6-b82a-2d580b80e235';

    expect(
      SalesOrderInputSchema.parse({
        customerId,
        lines: [{ productId, quantity: 4 }],
        note: 'Deliver before 10am',
      }),
    ).toEqual({
      customerId,
      lines: [{ productId, quantity: 4 }],
      note: 'Deliver before 10am',
    });
    expect(() =>
      SalesOrderInputSchema.parse({
        customerId,
        lines: [
          { productId, quantity: 4 },
          { productId, quantity: 2 },
        ],
      }),
    ).toThrow();
  });
});
