import { describe, expect, it } from 'vitest';

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
