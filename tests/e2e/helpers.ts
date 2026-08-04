import { expect, type Page } from '@playwright/test';

export async function loginAs(page: Page, role: 'manager' | 'staff' | 'owner') {
  const label = role[0]?.toUpperCase() + role.slice(1);
  await page.goto(`/login?role=${role}`);
  await page
    .getByRole('button', { name: new RegExp(`Continue as ${label}`, 'i') })
    .click();
  await expect(page).toHaveURL(/\/app/);
}

export async function apiPost<T>(
  page: Page,
  path: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const csrfResponse = await page.request.get('/api/v1/auth/csrf');
  const csrf = (await csrfResponse.json()) as { csrfToken: string };
  const response = await page.request.post(`/api/v1${path}`, {
    data: body,
    headers: {
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      Origin: 'http://localhost:3000',
      'X-CSRF-Token': csrf.csrfToken,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as T;
}
