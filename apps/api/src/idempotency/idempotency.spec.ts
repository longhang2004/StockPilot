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

  it('normalizes Date values and omits undefined fields consistently', async () => {
    const { fingerprintPayload } = await import('./idempotency.js');

    const withDate = fingerprintPayload({
      receivedAt: new Date('2026-08-04T03:30:00.000Z'),
    });
    const asIsoString = fingerprintPayload({
      receivedAt: '2026-08-04T03:30:00.000Z',
    });
    const withUndefined = fingerprintPayload({
      note: undefined,
      sku: 'OAT-12',
    });
    const withoutUndefined = fingerprintPayload({ sku: 'OAT-12' });

    expect(withDate).toBe(asIsoString);
    expect(withUndefined).toBe(withoutUndefined);
  });
});

describe('executeIdempotent replay behavior', () => {
  it('replays the stored response without running the work again', async () => {
    const { executeIdempotent, fingerprintPayload } =
      await import('./idempotency.js');
    const payload = { orderId: 'order-9' };
    const work = vi.fn();
    const transaction = {
      $executeRaw: vi.fn().mockResolvedValue([1]),
      idempotencyRecord: {
        create: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          fingerprint: fingerprintPayload(payload),
          responseBody: { accepted: true },
          responseStatus: 202,
        }),
      },
    };

    const result = await executeIdempotent(transaction as never, {
      key: 'delivery-42',
      organizationId: 'org-1',
      payload,
      responseStatus: 202,
      scope: 'integrations',
      work,
    });

    expect(result).toEqual({
      body: { accepted: true },
      replayed: true,
      responseStatus: 202,
    });
    expect(work).not.toHaveBeenCalled();
    expect(transaction.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('rejects a reused key whose payload differs from the stored fingerprint', async () => {
    const { executeIdempotent } = await import('./idempotency.js');
    const transaction = {
      $executeRaw: vi.fn().mockResolvedValue([1]),
      idempotencyRecord: {
        create: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          fingerprint: 'a-different-fingerprint',
          responseBody: { accepted: true },
          responseStatus: 202,
        }),
      },
    };

    await expect(
      executeIdempotent(transaction as never, {
        key: 'delivery-42',
        organizationId: 'org-1',
        payload: { orderId: 'order-9' },
        responseStatus: 202,
        scope: 'integrations',
        work: vi.fn(),
      }),
    ).rejects.toMatchObject({
      message:
        'This Idempotency-Key was already used with a different payload.',
    });
    expect(transaction.idempotencyRecord.create).not.toHaveBeenCalled();
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
