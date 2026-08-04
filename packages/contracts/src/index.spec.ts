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
});
