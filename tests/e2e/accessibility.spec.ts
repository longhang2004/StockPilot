import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { loginAs } from './helpers';

test.describe('axe smoke', () => {
  test('public page has no critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      ),
    ).toEqual([]);
  });

  test('login and workspace routes have no critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/login');
    const loginResults = await new AxeBuilder({ page }).analyze();
    expect(
      loginResults.violations.filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      ),
    ).toEqual([]);
    await loginAs(page, 'manager');
    for (const route of ['/app', '/app/orders', '/app/inventory']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter(
          (violation) =>
            violation.impact === 'critical' || violation.impact === 'serious',
        ),
      ).toEqual([]);
    }
  });
});
