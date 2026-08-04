import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

describe('storefront webhook signature', () => {
  const payload = {
    customer: { companyName: 'Acme Wholesale' },
    eventType: 'order.created',
    externalOrderId: 'WEB-100',
    items: [{ quantity: 2, sku: 'MILK-1' }],
  };

  it('accepts the canonical sha256 signature', async () => {
    const { verifyStorefrontSignature } =
      await import('./storefront-signature.js');
    const signature = createHmac('sha256', 'test-secret')
      .update(JSON.stringify(payload))
      .digest('hex');

    expect(() =>
      verifyStorefrontSignature(payload, `sha256=${signature}`, 'test-secret'),
    ).not.toThrow();
  });

  it('rejects a modified payload or secret', async () => {
    const { verifyStorefrontSignature } =
      await import('./storefront-signature.js');
    const signature = createHmac('sha256', 'test-secret')
      .update(JSON.stringify(payload))
      .digest('hex');

    expect(() =>
      verifyStorefrontSignature(
        { ...payload, externalOrderId: 'WEB-101' },
        signature,
        'test-secret',
      ),
    ).toThrow('Webhook signature is invalid.');
  });
});
