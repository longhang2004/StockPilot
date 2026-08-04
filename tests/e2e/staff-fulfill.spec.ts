import { expect, test } from '@playwright/test';

import { loginAs } from './helpers';

test('Staff sees the fulfillment queue without Manager-only controls', async ({
  page,
}) => {
  await loginAs(page, 'staff');
  await page.goto('/app/orders');
  await expect(
    page.getByRole('heading', { name: /sales orders/i }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /new draft/i })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /confirm order/i }),
  ).toHaveCount(0);
});
