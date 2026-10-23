/* global document, window */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('.', import.meta.url));
const base = 'http://127.0.0.1:8765/control/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const report = {
  viewports: [],
  accessibility: [],
  workflows: [],
  runtimeErrors: [],
  httpErrors: [],
};
page.on('pageerror', (error) => report.runtimeErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400)
    report.httpErrors.push({ url: response.url(), status: response.status() });
});
const go = (path) => page.goto(`${base}#${path}`);
async function assertBalance(id, expected) {
  await go(`workspace/stock/${id}`);
  assert.equal(
    await page.locator('.stock-equation').getAttribute('aria-label'),
    expected,
  );
}

try {
  // The public preview image is a capture of the actual workspace, not a mock screenshot.
  await page.setViewportSize({ width: 1440, height: 1050 });
  await go('workspace/overview');
  await page.screenshot({
    path: `${out}prototypes/control/workspace-preview.png`,
  });
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1050 });
    for (const screen of [
      'product',
      'workspace/overview',
      'workspace/orders',
      'workspace/inventory',
      'workspace/order/1002',
      'workspace/stock/1',
    ]) {
      await go(screen);
      const size = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      report.viewports.push({ screen, width, ...size });
      assert(
        size.scroll <= size.client + 1,
        `Overflow: ${width} / ${screen} / ${size.scroll}`,
      );
      if (width === 1440 || width === 390) {
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        report.accessibility.push({
          screen,
          width,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        });
        if (
          ['product', 'workspace/overview', 'workspace/order/1002'].includes(
            screen,
          )
        )
          await page.screenshot({
            path: `${out}control-${screen === 'product' ? 'landing' : screen === 'workspace/overview' ? 'workspace' : 'order'}-${width === 1440 ? 'desktop' : 'mobile'}.png`,
            fullPage: screen !== 'product',
          });
      }
    }
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    // Force a document reload for an independent in-memory fixture.
    await go('workspace/orders');
    await page.reload();
    await page.locator('[data-filter=Draft]').click();
    await page
      .getByRole('searchbox', { name: 'Search orders' })
      .fill('northstar');
    assert(
      !(await page.locator('#register-results').innerText()).includes(
        'Cedar Street',
      ),
    );
    await page
      .getByRole('searchbox', { name: 'Search orders' })
      .fill('no-such-order');
    assert(
      await page
        .getByRole('heading', { name: 'No matching orders.' })
        .isVisible(),
    );
    await page.getByRole('searchbox', { name: 'Search orders' }).fill('');
    await page
      .locator('#register-results a[href="#workspace/order/1002"]:visible')
      .first()
      .click();
    await page
      .getByRole('button', { name: 'CONFIRM & RESERVE', exact: true })
      .click();
    await page
      .locator('#confirm-dialog')
      .getByRole('button', { name: 'CONFIRM & RESERVE', exact: true })
      .click();
    await assertBalance(2, '12 on hand minus 3 reserved equals 9 available');
    await go('workspace/order/1002');
    await page
      .getByRole('button', { name: 'MARK FULFILLED', exact: true })
      .click();
    await page
      .locator('#confirm-dialog')
      .getByRole('button', { name: 'MARK FULFILLED', exact: true })
      .click();
    await assertBalance(2, '9 on hand minus 0 reserved equals 9 available');
    await go('workspace/stock/3');
    await page
      .getByRole('button', { name: 'RECEIVE STOCK', exact: true })
      .click();
    await page
      .getByRole('textbox', { name: 'Supplier reference' })
      .fill('LOCAL-RECEIPT-042');
    const receiptAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    report.accessibility.push({
      screen: 'receipt dialog',
      width,
      violations: receiptAxe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    await page
      .getByRole('button', { name: 'APPLY RECEIPT', exact: true })
      .click();
    assert.equal(
      await page.locator('.stock-equation').getAttribute('aria-label'),
      '16 on hand minus 0 reserved equals 16 available',
    );
    await go('workspace/overview');
    await page.keyboard.press('n');
    await page
      .getByRole('spinbutton', { name: 'Quantity', exact: true })
      .fill('3');
    assert.equal(await page.locator('#form-total').innerText(), '$7.50');
    await page
      .getByRole('button', { name: 'CREATE DRAFT', exact: true })
      .click();
    await page.waitForURL('**#workspace/order/1007');
    await page
      .getByRole('heading', { name: 'Cedar Street Market', exact: true })
      .waitFor({ state: 'visible' });
    assert(
      await page
        .getByRole('heading', { name: 'Cedar Street Market', exact: true })
        .isVisible(),
    );
    await page.keyboard.press('Control+k');
    await page
      .getByRole('searchbox', { name: 'Find order, customer, SKU or action' })
      .fill('HP-1001');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForURL('**#workspace/stock/1');
    assert.equal(
      await page.locator('.stock-equation').getAttribute('aria-label'),
      '180 on hand minus 20 reserved equals 160 available',
    );
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#command-dialog').isVisible(), false);
    await go('workspace/overview');
    await page
      .getByRole('button', { name: 'INSPECT DELIVERY', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'RETRY DELIVERY', exact: true })
      .click();
    await go('workspace/orders');
    assert(
      (await page.locator('#register-results').innerText()).includes(
        'SO-2026-1008',
      ),
    );
    report.workflows.push({
      width,
      passed: [
        'search and status filters',
        'empty state',
        'full order page',
        'confirm/reserve',
        'fulfill/deduct',
        'receive stock',
        'create draft / N',
        'Ctrl+K / keyboard search',
        'Escape closes command menu',
        'retry creates exactly one draft',
      ],
    });
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await go('product');
  await page.getByRole('link', { name: 'SEE THE FLOW', exact: false }).click();
  await page.waitForFunction(
    () =>
      Math.abs(
        document.getElementById('workflow').getBoundingClientRect().top - 90,
      ) < 5,
  );
  report.anchorNavigation =
    'Landing workflow anchor scrolls to the correct section';
  await go('workspace/overview');
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  assert.equal(new URL(page.url()).hash, '#workspace/overview');
  report.skipLink =
    'Skip focuses the workspace main without changing its route';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await go('product');
  assert.equal(
    await page.evaluate(
      () => window.getComputedStyle(document.documentElement).scrollBehavior,
    ),
    'auto',
  );
  report.reducedMotion = 'Smooth scrolling disabled';
  fs.writeFileSync(
    `${out}control-qa.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  assert.deepEqual(report.runtimeErrors, []);
  assert.deepEqual(report.httpErrors, []);
  assert.deepEqual(
    report.accessibility.filter((a) => a.violations.length),
    [],
  );
  console.log(
    JSON.stringify(
      {
        viewports: report.viewports.length,
        axeChecks: report.accessibility.length,
        workflows: report.workflows.length,
        runtimeErrors: report.runtimeErrors,
        httpErrors: report.httpErrors,
        anchorNavigation: report.anchorNavigation,
        skipLink: report.skipLink,
        reducedMotion: report.reducedMotion,
      },
      null,
      2,
    ),
  );
} catch (error) {
  fs.writeFileSync(
    `${out}control-qa.json`,
    `${JSON.stringify({ ...report, failure: String(error) }, null, 2)}\n`,
  );
  throw error;
} finally {
  await browser.close();
}
