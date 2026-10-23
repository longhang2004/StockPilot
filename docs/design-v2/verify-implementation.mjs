// Real Next application + local API/database. No intercepted or fabricated data.
/* global document */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const origin = process.env.ATLAS_URL ?? 'http://localhost:3000';
const captureOnly = process.env.CAPTURE_ONLY === '1';
const output = path.resolve('docs/design-v2/implementation-qa');
const assets = path.resolve('apps/web/public/product');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(assets, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(90_000);
const report = {
  origin,
  passed: false,
  viewports: [],
  accessibility: [],
  motion: [],
  errors: [],
};
page.on('pageerror', (error) => report.errors.push(error.message));
const settle = async () => {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
};
const capture = async (name, product = false) => {
  await settle();
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  if (product && captureOnly)
    await page.screenshot({ path: path.join(assets, `${name}.png`) });
};
const audit = async (name, width) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  report.accessibility.push({
    name,
    width,
    violations: results.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    })),
  });
};
try {
  await page.goto(`${origin}/login?role=owner`);
  await page.getByRole('button', { name: /Continue as Owner/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Operations overview' }),
  ).toBeVisible();
  for (const section of ['overview', 'orders', 'inventory']) {
    await page.goto(
      `${origin}/app${section === 'overview' ? '' : `/${section}`}`,
    );
    await expect(page.locator('.workspace-section-page h1')).toBeVisible();
    if (captureOnly && section === 'orders')
      await page
        .getByPlaceholder('Search order number or customer')
        .fill('SO-2026');
    if (captureOnly && section === 'inventory')
      await page.getByPlaceholder('Search SKU or product').fill('HP-');
    await capture(section, true);
  }
  if (captureOnly) {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`${origin}/app/settings`);
    await capture('settings-320');
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    report.viewports.push({ section: 'settings', width: 320, ...dimensions });
  }
  if (!captureOnly) {
    const sections = [
      'overview',
      'orders',
      'inventory',
      'receipts',
      'products',
      'partners',
      'imports',
      'integrations',
      'audit',
      'settings',
      'more',
    ];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
      for (const section of sections) {
        await page.goto(
          `${origin}/app${section === 'overview' ? '' : `/${section}`}`,
        );
        await expect(page.locator('.workspace-section-page h1')).toBeVisible();
        await settle();
        const dimensions = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        report.viewports.push({ section, width, ...dimensions });
        if (width === 320 || width === 1440) await audit(section, width);
        if (
          width === 390 ||
          width === 1440 ||
          (width === 320 && section === 'settings')
        )
          await capture(`${section}-${width}`);
      }
      await page.goto(origin);
      await settle();
      const dimensions = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      report.viewports.push({ section: 'landing', width, ...dimensions });
      if (width === 320 || width === 1440) await audit('landing', width);
      if (width === 390 || width === 1440) await capture(`landing-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/app/orders`);
    await page.getByRole('button', { name: /^Search workspace/ }).click();
    await expect(page.getByLabel('Search workspace records')).toBeFocused();
    await audit('search-dialog', 390);
    await capture('search-390');
    await page.getByLabel('Search workspace records').press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const orders = await page.request.get(
      `${origin}/api/v1/orders?status=DRAFT&pageSize=25`,
    );
    const draftItems = (await orders.json()).items;
    const draft =
      draftItems.find((item) => item.orderNumber === 'SO-2026-1002') ??
      draftItems[0];
    if (!draft)
      throw new Error(
        'Expected a draft in the local demo for drawer verification.',
      );
    await page.goto(`${origin}/app/orders?order=${draft.id}`);
    await expect(
      page.getByRole('dialog', { name: draft.orderNumber }),
    ).toBeVisible();
    await settle();
    await audit('order-detail', 390);
    await expect(
      page.getByRole('table', { name: 'Order lines', exact: true }),
    ).toBeVisible();
    await capture('order-detail-390');
    await page
      .getByRole('button', { name: 'Confirm order', exact: true })
      .click();
    await settle();
    await audit('stock-impact', 390);
    await capture('stock-impact-390');
    const action = await page
      .getByRole('button', { name: 'Confirm & reserve', exact: true })
      .boundingBox();
    if (!action || action.y + action.height > 844)
      throw new Error('Stock action is outside the mobile viewport.');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const receipts = await page.request.get(
      `${origin}/api/v1/receipts?pageSize=1`,
    );
    const receipt = (await receipts.json()).items[0];
    if (receipt) {
      await page.goto(`${origin}/app/receipts?receipt=${receipt.id}`);
      await settle();
      await audit('receipt-detail', 390);
      await capture('receipt-detail-390');
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin);
    await settle();
    for (const name of ['Overview', 'Orders', 'Inventory']) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect
        .poll(() =>
          page
            .locator('.tour-frame img')
            .evaluate(
              (element) => element.complete && element.naturalWidth > 0,
            ),
        )
        .toBe(true);
    }
    const canvas = page.locator('.logistics-map canvas');
    const signature = () => canvas.evaluate((element) => element.toDataURL());
    const before = await signature();
    await expect.poll(signature).not.toBe(before);
    await page.getByRole('button', { name: /^Pause motion/ }).click();
    const paused = await signature();
    await page.waitForTimeout(350);
    expect(await signature()).toBe(paused);
    report.motion.push(
      'Animated parcels advance; pause freezes the rendered canvas.',
    );
    await page.getByRole('button', { name: /^Play motion/ }).click();
    await expect.poll(signature).not.toBe(paused);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await settle();
    await expect(page.locator('.motion-toggle')).toBeHidden();
    const reduced = await signature();
    await page.waitForTimeout(350);
    expect(await signature()).toBe(reduced);
    report.motion.push('Reduced motion renders a static logistics map.');
  }
  report.passed =
    report.errors.length === 0 &&
    report.viewports.every(({ client, scroll }) => scroll <= client) &&
    report.accessibility.every(({ violations }) => violations.length === 0);
} catch (error) {
  report.errors.push(error.stack);
} finally {
  fs.writeFileSync(
    path.join(output, captureOnly ? 'capture.json' : 'results.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    passed: report.passed,
    viewports: report.viewports.length,
    axe: report.accessibility.length,
    failures: report.viewports.filter(({ client, scroll }) => scroll > client),
    accessibility: report.accessibility.filter(
      ({ violations }) => violations.length,
    ),
    errors: report.errors,
  }),
);
if (!report.passed) process.exitCode = 1;
