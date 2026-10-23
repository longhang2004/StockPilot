// Run while the narrowly scoped prototype server is listening on port 8765.
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
const errors = [];
const httpErrors = [];
const report = {
  viewportChecks: [],
  landingViewports: [],
  accessibility: [],
  interactions: [],
};
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400)
    httpErrors.push({ status: response.status(), url: response.url() });
});
const go = (concept, screen = 'overview') =>
  page.goto(`http://127.0.0.1:8765/?preview=${concept}&screen=${screen}`);
const navigate = (screen) =>
  page.locator(`[data-page=${screen}]:visible`).first().click();
const stockDetails = async (id, expected) => {
  await page
    .locator(`#list-results [data-action=product][data-id="${id}"]:visible`)
    .first()
    .click();
  assert.equal(
    await page.locator('.stock-equation').getAttribute('aria-label'),
    expected,
  );
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#detail').isVisible(), false);
};

try {
  for (const concept of ['atlas', 'relay', 'folio']) {
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const screen of ['overview', 'orders', 'inventory', 'receipts']) {
        await go(concept, screen);
        await page.evaluate(() => document.fonts.ready);
        const size = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        report.viewportChecks.push({ concept, width, screen, ...size });
        assert(
          size.scroll <= size.client + 1,
          `Overflow: ${concept}/${screen}/${width}`,
        );
        if (
          (width === 1440 || width === 390) &&
          screen === (concept === 'relay' ? 'orders' : 'overview')
        )
          await page.screenshot({
            path: `${output}${concept}-${width === 390 ? 'mobile' : 'desktop'}.png`,
            fullPage: true,
          });
        if (width === 1440 || width === 390) {
          const result = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          report.accessibility.push({
            concept,
            width,
            screen,
            violations: result.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                summary: n.failureSummary,
              })),
            })),
          });
        }
      }
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await go(concept, 'orders');
      await page.locator('[data-filter=Draft]').click();
      assert(
        (await page.locator('#list-results').innerText()).includes(
          'Cedar Street',
        ),
      );
      await page.getByRole('searchbox').fill('northstar');
      assert(
        !(await page.locator('#list-results').innerText()).includes(
          'Cedar Street',
        ),
      );
      await page.getByRole('searchbox').fill('nonexistent');
      assert(
        await page.getByText('No matching orders', { exact: true }).isVisible(),
      );
      await page.getByRole('searchbox').fill('');
      async function transition(action, confirmation) {
        if (concept === 'relay' && width > 620) {
          await page.locator('.queue-item[data-id="1002"]').click();
          await page.getByRole('button', { name: action, exact: true }).click();
        } else {
          await page
            .locator('#list-results [data-id="1002"]:visible')
            .first()
            .click();
          await page
            .locator('#detail')
            .getByRole('button', { name: action, exact: true })
            .click();
        }
        assert.deepEqual(
          await page
            .locator('#confirmation .impact-product')
            .first()
            .locator('dd strong')
            .allTextContents(),
          confirmation === 'Confirm & reserve'
            ? ['12', '3', '9']
            : ['9', '0', '9'],
        );
        await page
          .locator('#confirmation')
          .getByRole('button', { name: confirmation, exact: true })
          .click();
        const owner =
          concept === 'relay' && width > 620 ? '.queue-object' : '#detail';
        if (owner === '#detail') {
          await expect(
            page.locator(owner + ' .order-progress [aria-current=step] strong'),
          ).toHaveText(
            confirmation === 'Confirm & reserve' ? 'Confirmed' : 'Fulfilled',
          );
          await page
            .getByRole('button', { name: 'Close details', exact: true })
            .click();
        } else if (confirmation === 'Confirm & reserve') {
          // Relay advances to the next matching draft when the current one leaves this filter.
          assert.equal(
            await page.locator('.queue-item[data-id="1002"]').count(),
            0,
          );
        } else {
          await expect(
            page.locator(owner + ' .order-progress [aria-current=step] strong'),
          ).toHaveText('Fulfilled');
        }
      }
      await transition('Confirm order', 'Confirm & reserve');
      await navigate('inventory');
      await stockDetails(2, '12 on hand minus 3 reserved equals 9 available');
      await navigate('orders');
      await transition('Mark fulfilled', 'Mark fulfilled');
      await navigate('inventory');
      await stockDetails(2, '9 on hand minus 0 reserved equals 9 available');
      await page
        .getByRole('button', { name: 'Receive stock', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Supplier reference' })
        .fill('TEST-RECEIPT');
      await page
        .getByRole('button', { name: 'Apply receipt', exact: true })
        .click();
      await stockDetails(3, '16 on hand minus 0 reserved equals 16 available');
      await navigate('receipts');
      assert(
        (await page.locator('#list-results').innerText()).includes(
          'TEST-RECEIPT',
        ),
      );
      await page
        .locator('#list-results [data-action=receipt]:visible')
        .first()
        .click();
      assert(
        (await page.locator('.receipt-snapshot').innerText()).includes('16'),
      );
      await page.keyboard.press('Escape');
      await page
        .getByRole('searchbox', { name: 'Search receipts' })
        .fill('absent');
      assert(
        await page
          .getByRole('heading', { name: 'No matching receipts' })
          .isVisible(),
      );

      await page.keyboard.press('Control+k');
      const globalSearch = page.getByRole('searchbox', {
        name: 'Search orders and products',
      });
      await globalSearch.fill('HP-1002');
      assert.equal(
        await page
          .locator('#command-results [data-action=product][data-id="2"]')
          .count(),
        1,
      );
      await page
        .locator('#command-results [data-action=product][data-id="2"]')
        .click();
      assert.equal(
        await page.locator('.stock-equation').getAttribute('aria-label'),
        '9 on hand minus 0 reserved equals 9 available',
      );
      await page.keyboard.press('Escape');
      await page.keyboard.press('Control+k');
      await globalSearch.fill('doesnotexist');
      assert(
        await page
          .getByText('No results in this workspace', { exact: true })
          .isVisible(),
      );
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#command-dialog').isVisible(), false);
      await navigate('orders');
      await page
        .getByRole('button', { name: 'New order', exact: true })
        .click();
      await page
        .getByRole('spinbutton', { name: 'Quantity', exact: true })
        .fill('3');
      assert.equal(await page.locator('#form-total').innerText(), '$7.50');
      await page
        .getByRole('button', { name: 'Create draft', exact: true })
        .click();
      assert(
        (await page.locator('#list-results').innerText()).includes(
          'SO-2026-1007',
        ),
      );
      report.interactions.push({
        concept,
        width,
        passed: [
          'status filter',
          'search',
          'empty state',
          'confirm/reserve',
          'fulfill/deduct',
          'receipt/replenish',
          'receipt document and search',
          'global SKU search',
          'stock impact preview',
          'inspector retains order after state change',
          'create draft',
          'Escape closes dialog',
        ],
      });
    }
  }
  for (const concept of ['atlas', 'relay', 'folio']) {
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1050 });
      await page.goto(
        `http://127.0.0.1:8765/index.html?preview=${concept}&surface=landing`,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() =>
        [...document.images].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      );
      const size = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      report.landingViewports.push({ concept, width, ...size });
      assert(
        size.scroll <= size.client + 1,
        `Landing overflow: ${concept}/${width}`,
      );
      for (const button of await page.locator('.landing-actions a').all()) {
        const rect = await button.boundingBox();
        assert(
          rect.x >= 0 && rect.x + rect.width <= width + 1,
          `Clipped landing action: ${concept}/${width}`,
        );
      }
      if (width === 1440 || width === 390) {
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        report.accessibility.push({
          concept,
          width,
          screen: 'landing',
          violations: result.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        });
        await page.screenshot({
          path: `${output}refined-${concept}-landing-${width === 390 ? 'mobile' : 'desktop'}.png`,
        });
      }
      await page.getByRole('button', { name: 'Orders', exact: true }).click();
      assert(
        (await page.locator('#tour-image').getAttribute('src'))
          .split('?')[0]
          .endsWith(`${concept}-orders.png`),
      );
      assert(
        (await page.locator('#tour-open').getAttribute('href')).includes(
          'screen=orders',
        ),
      );
      await page
        .getByRole('button', { name: 'Inventory', exact: true })
        .click();
      assert(
        (await page.locator('#tour-image').getAttribute('src'))
          .split('?')[0]
          .endsWith(`${concept}-inventory.png`),
      );
      assert(
        (await page.locator('#tour-open').getAttribute('href')).includes(
          'screen=inventory',
        ),
      );
      await page
        .getByRole('link', { name: 'Explore demo', exact: false })
        .first()
        .click();
      await page
        .getByRole('heading', {
          name:
            concept === 'relay'
              ? 'Sales orders'
              : concept === 'folio'
                ? 'A clear path from order to delivery.'
                : 'Overview',
          exact: true,
        })
        .waitFor({ state: 'visible' });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:8765/');
  await page.getByRole('button', { name: 'B Relay' }).click();
  await page.frameLocator('#preview').locator('h1').waitFor();
  await page.getByRole('button', { name: 'Ứng dụng', exact: true }).click();
  await page
    .frameLocator('#preview')
    .getByRole('heading', { name: 'Sales orders', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.getElementById('preview-wrap').getBoundingClientRect().width <=
      392,
  );
  assert(
    await page
      .locator('#preview-wrap')
      .evaluate((el) => el.getBoundingClientRect().width <= 392),
  );
  report.gallery =
    'Concept switch, landing/app switch and mobile viewport passed';
  report.runtimeErrors = errors;
  report.httpErrors = httpErrors;
  fs.writeFileSync(
    `${output}workspace-qa.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(httpErrors, []);
  assert.deepEqual(
    report.accessibility.filter((a) => a.violations.length),
    [],
  );
  console.log(
    JSON.stringify(
      {
        viewportChecks: report.viewportChecks.length,
        landingViewports: report.landingViewports.length,
        axeChecks: report.accessibility.length,
        workflowRuns: report.interactions.length,
        gallery: report.gallery,
        runtimeErrors: errors,
        httpErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
