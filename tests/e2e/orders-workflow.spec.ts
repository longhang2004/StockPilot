import { expect, test } from '@playwright/test';

import { apiPost, loginAs } from './helpers';

type CatalogPage<T> = { items: T[] };
type Product = { id: string; sku: string };
type Customer = { id: string; companyName: string };
type Order = { id: string; orderNumber: string; status: string };

async function firstCatalogRecords(page: Parameters<typeof apiPost>[0]) {
  const [customerResponse, productResponse] = await Promise.all([
    page.request.get('/api/v1/customers?page=1&pageSize=100'),
    page.request.get('/api/v1/products?page=1&pageSize=100'),
  ]);
  expect(customerResponse.ok()).toBeTruthy();
  expect(productResponse.ok()).toBeTruthy();
  const customers = (await customerResponse.json()) as CatalogPage<Customer>;
  const products = (await productResponse.json()) as CatalogPage<Product>;
  expect(customers.items[0]).toBeTruthy();
  expect(products.items[0]).toBeTruthy();
  return { customer: customers.items[0]!, product: products.items[0]! };
}

test('a committed Draft whose response is lost recovers after reload without duplicating it', async ({
  page,
}) => {
  await loginAs(page, 'manager');
  const { customer, product } = await firstCatalogRecords(page);
  const attempts: Array<{ body: unknown; key: string | undefined }> = [];
  let committedOrder: Order | undefined;

  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    attempts.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()['idempotency-key'],
    });
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    committedOrder = (await response.json()) as Order;
    if (attempts.length === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ response });
  });

  await page.goto('/app/orders?new=1&source=browser-test');
  await page.getByLabel('Customer', { exact: true }).selectOption(customer.id);
  await page.getByLabel('Product for line 1').selectOption(product.id);
  await page.getByLabel('Quantity for line 1').fill('3');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByRole('dialog', { name: 'New draft order' }),
  ).toContainText(/result is not confirmed/i);

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).not.toHaveURL(/new=1/);
  await expect(
    page.getByRole('button', { name: 'Resume pending Draft request' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Resume pending Draft request' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Resume pending Draft request' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'New draft order' }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'New draft order' }),
  ).toContainText(/result is not confirmed/i);
  await page
    .getByRole('button', { name: /retry saved draft request/i })
    .click();

  await expect(page).toHaveURL(new RegExp(`order=${committedOrder?.id}`));
  await expect(
    page.getByRole('heading', { name: committedOrder?.orderNumber }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);

  const listResponse = await page.request.get(
    `/api/v1/orders?search=${encodeURIComponent(committedOrder!.orderNumber)}`,
  );
  expect(listResponse.ok()).toBeTruthy();
  const result = (await listResponse.json()) as {
    items: Order[];
    total: number;
  };
  expect(result.total).toBe(1);
  expect(result.items[0]).toMatchObject({
    id: committedOrder!.id,
    status: 'DRAFT',
  });
});

test('order URL state survives deep links, reload, browser history, and role checks', async ({
  page,
}) => {
  await loginAs(page, 'manager');
  const { customer, product } = await firstCatalogRecords(page);
  const order = await apiPost<Order>(page, '/orders', {
    customerId: customer.id,
    lines: [{ productId: product.id, quantity: 1 }],
  });

  await page.goto(
    `/app/orders?search=${encodeURIComponent(order.orderNumber)}&status=DRAFT&page=1&source=history-test`,
  );
  await expect(
    page.getByRole('button', { name: `Open ${order.orderNumber}` }),
  ).toBeVisible();
  await page.getByRole('button', { name: `Open ${order.orderNumber}` }).click();
  await expect(page).toHaveURL(new RegExp(`order=${order.id}`));
  await expect(page).toHaveURL(/search=.*status=DRAFT.*source=history-test/);
  await expect(
    page.getByRole('heading', { name: order.orderNumber }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: order.orderNumber }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/search=.*status=DRAFT.*source=history-test/);
  await expect(
    page.getByRole('button', { name: `Open ${order.orderNumber}` }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`order=${order.id}`));

  await loginAs(page, 'staff');
  await page.goto(`/app/orders?order=${order.id}`);
  await expect(page.getByRole('button', { name: /edit draft/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm order' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: /edit draft/i }).click();
  await expect(
    page.getByRole('dialog', { name: new RegExp(order.orderNumber) }),
  ).toBeVisible();
  await page
    .getByLabel('Note', { exact: true })
    .fill('Staff draft edit verified');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Staff draft edit verified')).toBeVisible();
});
