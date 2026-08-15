import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { loginAs } from './helpers';

test.describe('axe smoke', () => {
  test('public page has no critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/');
    // The hero entrance animations fade text in over ~350ms; axe sampling a
    // mid-fade element computes blended (lower-contrast) colors. Wait for
    // all animations to settle so the analysis sees the steady-state UI.
    await page.waitForFunction(
      () => document.getAnimations().length === 0,
      null,
      { timeout: 5_000 },
    );
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
