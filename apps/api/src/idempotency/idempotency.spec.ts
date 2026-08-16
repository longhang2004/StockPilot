import { describe, expect, it, vi } from 'vitest';

describe('idempotency fingerprint', () => {
  it('is stable across object key order but changes with payload values', async () => {
    const { fingerprintPayload } = await import('./idempotency.js');

    const first = fingerprintPayload({
      lines: [{ productId: 'product-1', quantity: 12 }],
      note: null,
    });
    const reordered = fingerprintPayload({
      note: null,
      lines: [{ quantity: 12, productId: 'product-1' }],
    });
    const changed = fingerprintPayload({
      lines: [{ productId: 'product-1', quantity: 11 }],
      note: null,
    });

    expect(first).toBe(reordered);
    expect(first).not.toBe(changed);
  });
});

describe('executeIdempotent cleanup', () => {
  it('purges expired records on every write so the table stays bounded', async () => {
    const { executeIdempotent } = await import('./idempotency.js');
    const transaction = {
      $executeRaw: vi.fn().mockResolvedValue([1]),
      idempotencyRecord: {
        create: vi.fn().mockResolvedValue({ id: 'record-1' }),
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    await executeIdempotent(transaction as never, {
      key: 'delivery-42',
      organizationId: 'org-1',
      payload: { orderId: 'order-9' },
      responseStatus: 202,
      scope: 'integrations',
      work: async () => ({ accepted: true }),
    });

    expect(transaction.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
    expect(transaction.idempotencyRecord.create).toHaveBeenCalledOnce();
  });
});
