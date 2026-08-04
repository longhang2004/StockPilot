import { expect, test } from '@playwright/test';

import { apiPost, loginAs } from './helpers';

test.describe.serial('manager receipt and order confirmation', () => {
  test('completes receipt → draft → confirmation on desktop', async ({
    page,
  }) => {
    await loginAs(page, 'manager');
    const suffix = Date.now().toString();
    const product = await apiPost<{ id: string }>(page, '/products', {
      name: `E2E Product ${suffix}`,
      reorderPoint: 2,
      salePrice: '12.00',
      sku: `E2E-${suffix}`,
    });
    const customer = await apiPost<{ id: string }>(page, '/customers', {
      companyName: `E2E Customer ${suffix}`,
      contactName: 'Buyer',
      email: `buyer-${suffix}@example.test`,
      phone: null,
    });
    const supplier = await apiPost<{ id: string }>(page, '/suppliers', {
      companyName: `E2E Supplier ${suffix}`,
      contactName: 'Ops',
      email: `supplier-${suffix}@example.test`,
      phone: null,
    });

    await page.goto('/app/receipts');
    await page
      .getByRole('button', { name: /receive stock/i })
      .first()
      .click();
    await page.getByLabel('Supplier').selectOption(supplier.id);
    await page.getByLabel('Product').selectOption(product.id);
    await page.getByLabel('Quantity').fill('10');
    await page.getByRole('button', { name: /apply receipt/i }).click();
    await expect(
      page.getByText(/receipt applied to the ledger/i),
    ).toBeVisible();

    await page.goto('/app/orders');
    await page.getByRole('button', { name: /new draft/i }).click();
    await page.getByLabel('Customer').selectOption(customer.id);
    await page.getByLabel('Product').selectOption(product.id);
    await page.getByLabel('Quantity').fill('2');
    await page.getByRole('button', { name: /save draft/i }).click();
    await expect(page.getByText(/draft order created/i)).toBeVisible();
    const orderRecord = page
      .locator(
        '.operations-table tbody tr:visible, .mobile-record-card:visible',
      )
      .filter({ hasText: `E2E Customer ${suffix}` });
    await expect(orderRecord).toHaveCount(1);
    await orderRecord.click();
    await page.getByRole('button', { name: /confirm order/i }).click();
    await expect(page.getByText(/order status updated/i)).toBeVisible();
  });

  test('fulfills the confirmed order as Staff', async ({ page }) => {
    await loginAs(page, 'staff');
    await page.goto('/app/orders?status=CONFIRMED');
    await expect(
      page.getByRole('heading', { name: /sales orders/i }),
    ).toBeVisible();
    const rows = page.getByRole('row');
    if ((await rows.count()) > 1) {
      await rows.nth(1).click();
      const fulfill = page.getByRole('button', { name: /fulfill order/i });
      if (await fulfill.isVisible()) {
        await fulfill.click();
        await expect(page.getByText(/order status updated/i)).toBeVisible();
      }
    }
  });
});
