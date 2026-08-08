import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StripeClient } from './stripe-client.js';

const secret = 'whsec_test_secret_with_enough_length';

function signatureHeader(payload: string, atSeconds: number): string {
  const timestamp = Math.floor(atSeconds);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('StripeClient webhook signature verification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a valid signature', () => {
    const client = new StripeClient('sk_test');
    const payload = Buffer.from('{"type":"customer.subscription.updated"}');
    const header = signatureHeader(payload.toString('utf8'), Date.now() / 1000);
    expect(client.verifyWebhookSignature(payload, header, secret)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const client = new StripeClient('sk_test');
    const payload = Buffer.from('{"type":"customer.subscription.updated"}');
    const tampered = Buffer.from('{"type":"customer.subscription.deleted"}');
    const header = signatureHeader(payload.toString('utf8'), Date.now() / 1000);
    expect(client.verifyWebhookSignature(tampered, header, secret)).toBe(false);
  });

  it('rejects signatures older than the five-minute window', () => {
    const client = new StripeClient('sk_test');
    const payload = Buffer.from('{"type":"customer.subscription.updated"}');
    const stale = signatureHeader(
      payload.toString('utf8'),
      Date.now() / 1000 - 400,
    );
    expect(client.verifyWebhookSignature(payload, stale, secret)).toBe(false);
  });

  it('rejects missing or malformed headers', () => {
    const client = new StripeClient('sk_test');
    const payload = Buffer.from('{"type":"customer.subscription.updated"}');
    expect(client.verifyWebhookSignature(payload, undefined, secret)).toBe(
      false,
    );
    expect(
      client.verifyWebhookSignature(payload, 'v1=not-a-real-signature', secret),
    ).toBe(false);
    expect(client.verifyWebhookSignature(payload, '', secret)).toBe(false);
  });

  it('issues form-encoded authenticated requests to Stripe endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ id: 'cus_test', url: 'https://checkout' }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 },
          ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new StripeClient('sk_test_123');
    const customer = await client.createCustomer({
      email: 'owner@example.test',
      name: 'Acme Wholesale',
    });
    expect(customer.id).toBe('cus_test');

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://api.stripe.com/v1/customers');
    expect(call[1].headers).toMatchObject({
      Authorization: 'Bearer sk_test_123',
    });
    expect(call[1].body).toContain('email=owner%40example.test');

    const portal = await client.createBillingPortalSession({
      customer: 'cus_test',
      returnUrl: 'https://app.example.test/settings',
    });
    expect(portal.url).toBe('https://checkout');
  });

  it('surfaces Stripe error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'No such customer: cus_x' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        }),
      ),
    );
    const client = new StripeClient('sk_test_123');
    await expect(
      client.createBillingPortalSession({
        customer: 'cus_x',
        returnUrl: 'https://app.example.test/settings',
      }),
    ).rejects.toThrow('No such customer');
  });
});
