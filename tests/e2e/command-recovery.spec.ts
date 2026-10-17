import { expect, test } from '@playwright/test';

import { apiPost, loginAs } from './helpers';

test('recovers a committed adjustment after its response is lost and the page reloads', async ({
  page,
}) => {
  await loginAs(page, 'manager');
  const suffix = Date.now().toString();
  const product = await apiPost<{ id: string }>(page, '/products', {
    name: `Recovery Product ${suffix}`,
    reorderPoint: 0,
    salePrice: '12.00',
    sku: `RECOVERY-${suffix}`,
  });

  const attempts: Array<{ body: unknown; key: string | undefined }> = [];
  await page.route('**/api/v1/inventory/adjustments', async (route) => {
    attempts.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()['idempotency-key'],
    });
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    if (attempts.length === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ response });
  });

  await page.goto('/app/inventory');
  await page.getByRole('button', { name: /adjust stock/i }).click();
  await page.getByLabel('Search products').fill(`RECOVERY-${suffix}`);
  await expect(
    page.getByRole('option', { name: new RegExp(`RECOVERY-${suffix}`) }),
  ).toBeAttached();
  await page.getByLabel('Product', { exact: true }).selectOption(product.id);
  await page.getByLabel('Quantity', { exact: true }).fill('7');
  await page
    .getByLabel('Reason', { exact: true })
    .fill('Lost response recovery check');
  await page.getByRole('button', { name: /apply adjustment/i }).click();
  await expect(
    page.getByRole('dialog', { name: 'Adjust inventory' }).getByRole('alert'),
  ).toContainText(/result is not confirmed/i);

  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await page.getByRole('button', { name: /adjust stock/i }).click();
  await expect(
    page.getByRole('dialog', { name: 'Adjust inventory' }).getByRole('alert'),
  ).toContainText(/result is not confirmed/i);
  await page.getByRole('button', { name: /retry same adjustment/i }).click();
  await expect(
    page.getByText('Stock adjustment applied to the ledger.'),
  ).toBeVisible();

  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  const balanceResponse = await page.request.get(
    `/api/v1/inventory/balances?search=RECOVERY-${suffix}`,
  );
  expect(balanceResponse.ok()).toBeTruthy();
  const balances = (await balanceResponse.json()) as {
    items: Array<{ available: number; onHand: number; productId: string }>;
  };
  expect(balances.items).toEqual([
    expect.objectContaining({
      available: 7,
      onHand: 7,
      productId: product.id,
    }),
  ]);
  const movementResponse = await page.request.get(
    `/api/v1/inventory/movements?search=RECOVERY-${suffix}&type=ADJUSTMENT_IN`,
  );
  expect(movementResponse.ok()).toBeTruthy();
  const movements = (await movementResponse.json()) as { total: number };
  expect(movements.total).toBe(1);
});
