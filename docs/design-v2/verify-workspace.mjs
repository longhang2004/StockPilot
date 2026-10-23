// Focused checks for the in-app detail, global search and receipt experience.
/* global document */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const report = { passed: false, accessibility: [], workflows: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
const go = (screen) =>
  page.goto(`http://127.0.0.1:8765/?preview=atlas&screen=${screen}`);
const nav = (screen) =>
  page.locator(`[data-page=${screen}]:visible`).first().click();
const close = () =>
  page.getByRole('button', { name: 'Close details', exact: true }).click();
const audit = async (screen, width) => {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  report.accessibility.push({
    screen,
    width,
    violations: result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  assert.equal(result.violations.length, 0, `${screen}/${width} accessibility`);
};

try {
  for (const width of [1440, 390]) {
    const device = width === 1440 ? 'desktop' : 'mobile';
    await page.setViewportSize({ width, height: 1000 });
    await go('orders');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}workspace-orders-${device}.png` });
    await page
      .locator('#list-results [data-action=order][data-id="1002"]:visible')
      .first()
      .click();
    const action = await page
      .getByRole('button', { name: 'Confirm order', exact: true })
      .boundingBox();
    assert(
      action.y >= 0 && action.y + action.height <= 1000,
      'Main action stays visible without scrolling',
    );
    await page.screenshot({ path: `${output}workspace-order-${device}.png` });
    await audit('order details', width);
    await page
      .getByRole('button', { name: 'Confirm order', exact: true })
      .click();
    await page.screenshot({ path: `${output}workspace-impact-${device}.png` });
    await audit('stock impact confirmation', width);
    await page.keyboard.press('Escape');
    await close();

    await page
      .getByRole('button', { name: 'Search workspace', exact: true })
      .click();
    const search = page.getByRole('searchbox', {
      name: 'Search orders and products',
    });
    await search.fill('HP-1002');
    await page.screenshot({ path: `${output}workspace-search-${device}.png` });
    await audit('global search', width);
    await search.press('Enter');
    await expect(page.locator('#detail-title')).toHaveText(
      'Cedar Street Market',
    );
    await close();

    await page.getByRole('button', { name: 'New order', exact: true }).click();
    await page
      .getByRole('spinbutton', { name: 'Quantity', exact: true })
      .fill('1000');
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click();
    await page
      .locator('#list-results [data-action=order][data-id="1007"]:visible')
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: 'Confirm order', exact: true }),
    ).toBeDisabled();
    await expect(
      page.locator('#detail .line-stock.short:visible'),
    ).toContainText('Short by 840');
    await audit('insufficient stock', width);
    await close();

    await nav('receipts');
    await page
      .getByRole('button', { name: 'Receive stock', exact: true })
      .click();
    await page
      .getByRole('combobox', { name: 'Product', exact: true })
      .selectOption('2');
    await expect(page.locator('#receipt-current')).toContainText(
      '12 each on hand',
    );
    await page.getByRole('spinbutton', { name: 'Quantity received' }).fill('5');
    const reference = page.getByRole('textbox', { name: 'Supplier reference' });
    await reference.fill('   ');
    await page
      .getByRole('button', { name: 'Apply receipt', exact: true })
      .click();
    assert.equal(
      await page.locator('#prototype-form').evaluate((f) => f.checkValidity()),
      false,
    );
    await reference.fill('DN-REVIEW-001');
    await audit('receipt form', width);
    await page
      .getByRole('button', { name: 'Apply receipt', exact: true })
      .click();
    await expect(page.locator('#list-results')).toContainText('DN-REVIEW-001');
    await page.screenshot({
      path: `${output}workspace-receipts-${device}.png`,
    });
    await audit('recorded receipts', width);
    await page
      .locator('#list-results [data-action=receipt]:visible')
      .first()
      .click();
    await page.screenshot({ path: `${output}workspace-receipt-${device}.png` });
    await audit('receipt document', width);
    await page.getByRole('button', { name: 'View current stock' }).click();
    await expect(page.locator('#detail-title')).toBeFocused();
    await expect(page.locator('.stock-equation')).toHaveAttribute(
      'aria-label',
      '17 on hand minus 0 reserved equals 17 available',
    );
    await close();
    report.workflows.push({
      width,
      stickyAction: true,
      searchEnter: true,
      shortageBlocked: true,
      supplierReferenceValidated: true,
      receiptLinkedToCurrentStock: true,
      relatedRecordFocus: true,
    });
  }
  // Keep the landing tour in sync with the reviewed app, using the same source.
  await page.setViewportSize({ width: 1440, height: 960 });
  for (const concept of ['atlas', 'relay', 'folio']) {
    for (const screen of ['overview', 'orders', 'inventory']) {
      await page.goto(
        `http://127.0.0.1:8765/?preview=${concept}&screen=${screen}`,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${output}prototypes/assets/${concept}-${screen}.png`,
      });
    }
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(
    JSON.stringify({
      passed: report.passed,
      overlaysAudited: report.accessibility.length,
      workflows: report.workflows.length,
      errors: report.errors,
    }),
  );
} finally {
  fs.writeFileSync(
    `${output}workspace-overlay-qa.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
}
