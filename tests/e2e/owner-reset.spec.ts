import { expect, test } from '@playwright/test';

import { loginAs } from './helpers';

test('Owner can inspect team visibility and reset the demo safely', async ({
  page,
}) => {
  await loginAs(page, 'owner');
  await page.goto('/app/settings');
  await expect(
    page.getByRole('heading', { name: /organization settings/i }),
  ).toBeVisible();
  // The demo team list is visible to the Owner.
  await expect(
    page.getByText('owner@stockpilot-demo.stockpilot.test'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /reset demo data/i })
    .first()
    .click();
  await page.getByRole('button', { name: /^reset demo$/i }).click();
  await expect(page).toHaveURL(/\/app/);
});
