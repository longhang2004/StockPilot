import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { apiPost, loginAs } from './helpers';

test('Atlas keeps stock previews, interrupted commands and workspace search connected', async ({
  page,
}, testInfo) => {
  await loginAs(page, 'manager');
  const suffix = Date.now().toString();
  const product = await apiPost<{ id: string }>(page, '/products', {
    name: `Atlas cartons ${suffix}`,
    sku: `ATLAS-${suffix}`,
    salePrice: '12.00',
    reorderPoint: 1,
  });
  const customer = await apiPost<{ id: string }>(page, '/customers', {
    companyName: `Atlas customer ${suffix}`,
    contactName: null,
    email: null,
    phone: null,
  });
  const supplier = await apiPost<{ id: string }>(page, '/suppliers', {
    companyName: `Atlas supplier ${suffix}`,
    contactName: null,
    email: null,
    phone: null,
  });
  await apiPost(
    page,
    '/receipts',
    {
      supplierId: supplier.id,
      receiptNumber: `ATLAS-IN-${suffix}`,
      receivedAt: new Date().toISOString(),
      lines: [{ productId: product.id, quantity: 10, unitCost: '2.00' }],
      note: null,
    },
    `atlas-receipt-${suffix}`,
  );
  const order = await apiPost<{ id: string; orderNumber: string }>(
    page,
    '/orders',
    {
      customerId: customer.id,
      lines: [{ productId: product.id, quantity: 3 }],
      note: null,
    },
    `atlas-order-${suffix}`,
  );
  await page.goto(`/app/orders?order=${order.id}`);
  await expect(
    page.getByRole('table', { name: 'Order lines', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Order lines', exact: true })
      .getByText(`Atlas cartons ${suffix}`, { exact: true }),
  ).toBeVisible();
  const originalViewport = page.viewportSize();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole('table', { name: 'Order lines', exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('table', { name: 'Order lines', exact: true })
        .getByText(`Atlas cartons ${suffix}`, { exact: true }),
    ).toBeInViewport();
    if (width === 390)
      await page.screenshot({
        path: `docs/design-v2/implementation-qa/order-lines-${testInfo.project.name}.png`,
      });
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  }
  if (originalViewport) await page.setViewportSize(originalViewport);
  const orderAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(orderAccessibility.violations).toEqual([]);
  await page
    .getByRole('button', { name: 'Confirm order', exact: true })
    .click();
  const impact = page.getByRole('table', {
    name: `Stock impact for ATLAS-${suffix}`,
  });
  await expect(
    impact.getByRole('row', { name: 'On hand 10 10', exact: true }),
  ).toBeVisible();
  await expect(
    impact.getByRole('row', { name: 'Reserved 0 3', exact: true }),
  ).toBeVisible();
  await expect(
    impact.getByRole('row', { name: 'Available 10 7', exact: true }),
  ).toBeVisible();
  const keys: Array<string | undefined> = [];
  await page.route(`**/api/v1/orders/${order.id}/confirm`, async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    if (keys.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await page
    .getByRole('button', { name: 'Confirm & reserve', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'result is not confirmed',
  );
  await page.reload();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Retry same status update' })
    .click();
  await expect(
    page.getByText('Order status updated.', { exact: true }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  await expect(
    page.getByRole('dialog', { name: order.orderNumber }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Fulfill order', exact: true })
    .click();
  await expect(
    impact.getByRole('row', { name: 'On hand 10 7', exact: true }),
  ).toBeVisible();
  await expect(
    impact.getByRole('row', { name: 'Reserved 3 0', exact: true }),
  ).toBeVisible();
  await expect(
    impact.getByRole('row', { name: 'Available 7 7', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Fulfill order', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: order.orderNumber }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('Fulfilled', { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search workspace records').fill(`ATLAS-${suffix}`);
  await expect(
    page.getByRole('link', { name: new RegExp(`Atlas cartons ${suffix}`) }),
  ).toBeVisible();
  await page.getByLabel('Search workspace records').press('Enter');
  await expect(page).toHaveURL(new RegExp(`inventory\\?product=${product.id}`));
  await expect(page.getByRole('dialog', { name: 'Stock trace' })).toBeVisible();
  const balance = await page.request.get(
    `/api/v1/inventory/balances?search=ATLAS-${suffix}`,
  );
  expect((await balance.json()).items[0]).toMatchObject({
    onHand: 7,
    reserved: 0,
    available: 7,
  });

  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page
    .getByLabel('Search workspace records')
    .fill(`Atlas customer ${suffix}`);
  await expect(
    page
      .getByRole('dialog')
      .getByRole('link', { name: new RegExp(`^Atlas customer ${suffix}`) }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: new RegExp(`^Atlas customer ${suffix}`) })
    .click();
  await expect(page).toHaveURL(/partners\?search=/);
  await expect(
    page.getByRole('searchbox', { name: 'Search', exact: true }),
  ).toHaveValue(`Atlas customer ${suffix}`);

  const shortage = await apiPost<{ id: string }>(
    page,
    '/orders',
    {
      customerId: customer.id,
      lines: [{ productId: product.id, quantity: 9 }],
      note: null,
    },
    `atlas-short-${suffix}`,
  );
  await page.goto(`/app/orders?order=${shortage.id}`);
  await expect(page.getByText('Short by 2 · 7 available')).toBeVisible();
  await page
    .getByRole('button', { name: 'Confirm order', exact: true })
    .click();
  await expect(
    page.getByText('Short by 2 units. Receive stock or update the draft.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm & reserve', exact: true }),
  ).toBeDisabled();
});
