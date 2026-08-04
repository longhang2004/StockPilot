import { expect, test } from '@playwright/test';

import { loginAs } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile workspace keeps the receipt and order actions reachable', async ({
  page,
}) => {
  await loginAs(page, 'manager');
  await page.goto('/app/receipts');
  await expect(
    page.getByRole('navigation', { name: /mobile workspace/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /receive stock/i }).first(),
  ).toBeVisible();
  await page.goto('/app/orders');
  await expect(page.getByRole('button', { name: /new draft/i })).toBeVisible();
});
