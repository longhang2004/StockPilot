import { createHmac } from 'node:crypto';

import { expect, test } from '@playwright/test';

test('the same storefront delivery is processed once', async ({ request }) => {
  const payload = {
    customer: {
      companyName: 'Webhook E2E Customer',
      email: 'webhook-e2e@example.test',
    },
    eventType: 'order.created',
    externalOrderId: `e2e-${Date.now()}`,
    items: [{ quantity: 1, sku: 'UNKNOWN-E2E-SKU' }],
  };
  const signature = createHmac(
    'sha256',
    process.env.WEBHOOK_SIGNING_SECRET ?? 'ci-webhook-secret',
  )
    .update(JSON.stringify(payload))
    .digest('hex');
  const headers = {
    Origin: 'http://localhost:3000',
    'x-delivery-id': `delivery-e2e-${Date.now()}`,
    'x-organization-slug': 'stockpilot-demo',
    'x-storefront-signature': `sha256=${signature}`,
  };
  const first = await request.post('/api/v1/webhooks/mock-storefront/orders', {
    data: payload,
    headers,
  });
  const second = await request.post('/api/v1/webhooks/mock-storefront/orders', {
    data: payload,
    headers,
  });
  expect(first.ok()).toBeTruthy();
  expect(second.ok()).toBeTruthy();
  expect((await first.json()).duplicate).toBe(false);
  expect((await second.json()).duplicate).toBe(true);
});
