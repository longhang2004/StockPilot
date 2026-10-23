// Capture the running Atlas app. Uses existing records; never submits business commands.
/* global document, innerWidth */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const origin = 'http://localhost:3000';
const output = path.resolve('docs/design-v2/demo-media-20261023');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const auth = await browser.newContext();
const login = await auth.newPage();
await login.goto(`${origin}/login?role=manager`);
await login.getByRole('button', { name: /Continue as Manager/ }).click();
await expect(
  login.getByRole('heading', { name: 'Operations overview' }),
).toBeVisible();
const state = await auth.storageState();
const read = async (resource) => {
  const response = await login.request.get(`${origin}/api/v1/${resource}`);
  expect(response.ok()).toBe(true);
  return response.json();
};
const drafts = await read('orders?status=DRAFT&pageSize=50&search=SO-2026');
const draft = drafts.items.find((item) => item.orderNumber === 'SO-2026-1002');
const receipts = await read('receipts?pageSize=50');
const receipt = receipts.items.find(
  (item) => item.receiptNumber === 'GR-2026-001',
);
const products = await read('products?pageSize=25&search=HP-1005');
const product = products.items.find((item) => item.sku === 'HP-1005');
if (!draft || !receipt || !product)
  throw new Error('Expected existing demo records are unavailable.');

const report = {
  origin,
  createdAt: new Date().toISOString(),
  screenshots: [],
  chapters: [],
  errors: [],
  businessWrites: [],
};
const desktop = await browser.newContext({
  storageState: state,
  viewport: { width: 1440, height: 1000 },
  recordVideo: {
    dir: path.join(output, 'raw-video'),
    size: { width: 1440, height: 1000 },
  },
});
const page = await desktop.newPage();
const start = Date.now();
for (const context of [desktop]) {
  context.on('page', (p) =>
    p.on('pageerror', (error) => report.errors.push(error.message)),
  );
  context.on('request', (request) => {
    if (
      /\/api\/v1\/(orders|receipts|inventory|products|customers|suppliers)(\/|\?|$)/.test(
        request.url(),
      ) &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method())
    ) {
      report.businessWrites.push({
        method: request.method(),
        url: request.url(),
      });
    }
  });
}
page.on('pageerror', (error) => report.errors.push(error.message));
const settle = async (p = page) => {
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => document.fonts.ready);
  await expect(p.locator('.skeleton-stack')).toHaveCount(0);
};
const hold = (ms = 3500, p = page) =>
  p.waitForTimeout(process.env.REHEARSAL === '1' ? Math.min(ms, 500) : ms);
const chapter = (title, detail) => {
  const time = (Date.now() - start) / 1000;
  report.chapters.push({ time, title, detail });
  console.log(`Chapter ${time.toFixed(1)}s: ${title}`);
};
const shot = async (name, p = page, fullPage = false) => {
  await settle(p);
  const dimensions = await p.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  await p.screenshot({ path: path.join(output, `${name}.png`), fullPage });
  report.screenshots.push({
    file: `${name}.png`,
    ...p.viewportSize(),
    fullPage,
  });
};
try {
  chapter(
    'Landing · Bản đồ logistics',
    'Canvas kho và kiện hàng chuyển động bên dưới hero.',
  );
  await page.goto(origin);
  await settle();
  await hold(5500);
  await shot('01-landing-desktop');
  await page.screenshot({
    path: path.join(output, '02-landing-full.png'),
    fullPage: true,
  });
  report.screenshots.push({
    file: '02-landing-full.png',
    width: 1440,
    fullPage: true,
  });
  chapter('Product tour', 'Xem các màn hình thật ngay trên landing.');
  await page.locator('.tour-frame').scrollIntoViewIfNeeded();
  await hold(2200);
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await hold(2000);
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await hold(2000);
  chapter(
    'Tổng quan vận hành',
    'Các chỉ số và công việc cần chú ý trong workspace.',
  );
  await page.goto(`${origin}/app`);
  await expect(
    page.getByRole('heading', { name: 'Operations overview' }),
  ).toBeVisible();
  await shot('03-overview-desktop');
  await hold(4500);
  chapter('Đơn hàng', 'Tìm các đơn mẫu bằng bộ lọc có sẵn.');
  await page.getByRole('link', { name: 'Orders', exact: true }).first().click();
  const orderSearch = page.getByPlaceholder('Search order number or customer');
  await orderSearch.pressSequentially('SO-2026', { delay: 140 });
  await expect(
    page.getByText(draft.orderNumber, { exact: true }).first(),
  ).toBeVisible();
  await shot('04-orders-desktop');
  await hold(4000);
  chapter(
    'Chi tiết đơn hàng',
    'Sản phẩm, số lượng, giá và khả năng đáp ứng cùng một chỗ.',
  );
  await page
    .getByRole('button', { name: `Open ${draft.orderNumber}`, exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: draft.orderNumber }),
  ).toBeVisible();
  await expect(
    page.locator('.order-stock-availability').getByText(/available · 3 needed/),
  ).toBeVisible();
  await shot('05-order-detail-desktop');
  await hold(5000);
  chapter(
    'Xem trước tác động tồn kho',
    'Xem thay đổi on hand / reserved / available trước khi xác nhận.',
  );
  await page
    .getByRole('button', { name: 'Confirm order', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Confirm & reserve', exact: true }),
  ).toBeEnabled();
  await shot('06-stock-impact-desktop');
  await hold(5500);
  await page
    .getByRole('button', { name: 'Back to order', exact: true })
    .click();
  await hold(800);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await hold(500);
  chapter(
    'Tìm kiếm nhanh',
    'Từ SKU đi thẳng đến truy vết tồn kho bằng Ctrl K.',
  );
  await page.keyboard.press('Control+k');
  const globalSearch = page.getByLabel('Search workspace records');
  await expect(globalSearch).toBeFocused();
  await hold(300);
  await globalSearch.pressSequentially('HP-1005', { delay: 160 });
  await expect(page.locator('.workspace-search-result').first()).toBeVisible();
  await shot('07-global-search-desktop');
  await hold(3500);
  await globalSearch.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Stock trace' })).toBeVisible();
  chapter(
    'Truy vết tồn kho',
    'Theo dõi số dư, đơn đang giữ hàng và các giao dịch nguồn.',
  );
  await shot('08-stock-trace-desktop');
  await hold(5000);
  await page.keyboard.press('Escape');
  await page.getByPlaceholder('Search SKU or product').fill('HP-');
  await shot('09-inventory-desktop');
  await hold(3000);
  chapter(
    'Phiếu nhập hàng',
    'Mở chứng từ nhập và theo dõi số dư trước / sau từng dòng.',
  );
  await page
    .getByRole('link', { name: 'Receipts', exact: true })
    .first()
    .click();
  await page
    .getByPlaceholder('Search receipt number or supplier')
    .fill('GR-2026');
  await expect(
    page.getByText(receipt.receiptNumber, { exact: true }).first(),
  ).toBeVisible();
  await shot('10-receipts-desktop');
  await hold(2000);
  await page
    .getByRole('button', { name: `Open ${receipt.receiptNumber}`, exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Receipt detail' }),
  ).toBeVisible();
  await shot('11-receipt-detail-desktop');
  await hold(5000);
  report.desktopSeconds = (Date.now() - start) / 1000;
  const video = page.video();
  await desktop.close();
  await video.saveAs(path.join(output, 'stockpilot-atlas-desktop.webm'));
  await fs.unlink(await video.path());

  console.log('Desktop video saved. Capturing mobile views.');
  const mobile = await browser.newContext({
    storageState: state,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  phone.on('pageerror', (error) => report.errors.push(error.message));
  await phone.goto(origin);
  await shot('12-landing-mobile', phone);
  await phone.goto(`${origin}/app`);
  await shot('13-overview-mobile', phone);
  await phone.goto(`${origin}/app/orders?search=SO-2026&status=DRAFT`);
  await expect(
    phone.getByRole('button', {
      name: `Open ${draft.orderNumber}`,
      exact: true,
    }),
  ).toBeVisible();
  await shot('14-orders-mobile', phone);
  await phone
    .getByRole('button', { name: `Open ${draft.orderNumber}`, exact: true })
    .click();
  await expect(
    phone.getByRole('dialog', { name: draft.orderNumber }),
  ).toBeVisible();
  await expect(
    phone
      .getByRole('table', { name: 'Order lines', exact: true })
      .getByText('Stretch Wrap 500mm', { exact: true }),
  ).toBeInViewport();
  await shot('15-order-detail-mobile', phone);
  await phone
    .getByRole('button', { name: 'Confirm order', exact: true })
    .click();
  await expect(
    phone.getByRole('button', { name: 'Confirm & reserve', exact: true }),
  ).toBeEnabled();
  await shot('16-stock-impact-mobile', phone);
  await phone.goto(`${origin}/app/inventory?product=${product.id}`);
  await expect(
    phone.getByRole('dialog', { name: 'Stock trace' }),
  ).toBeVisible();
  await shot('17-stock-trace-mobile', phone);
  await phone.goto(`${origin}/app/receipts?receipt=${receipt.id}`);
  await expect(
    phone.getByRole('heading', { name: 'Receipt detail' }),
  ).toBeVisible();
  await shot('18-receipt-detail-mobile', phone);
  await mobile.close();
  const after = await read(`orders/${draft.id}`);
  expect(after.status).toBe('DRAFT');
  expect(report.businessWrites).toEqual([]);
  expect(report.errors).toEqual([]);
  report.passed = true;
  const stamp = (seconds) => {
    const millis = Math.round(seconds * 1000);
    return `${String(Math.floor(millis / 3600000)).padStart(2, '0')}:${String(Math.floor(millis / 60000) % 60).padStart(2, '0')}:${String(Math.floor(millis / 1000) % 60).padStart(2, '0')}.${String(millis % 1000).padStart(3, '0')}`;
  };
  const vtt = [
    'WEBVTT',
    '',
    ...report.chapters.flatMap((item, i) => [
      `${stamp(item.time)} --> ${stamp(report.chapters[i + 1]?.time ?? report.desktopSeconds)}`,
      `${item.title}\n${item.detail}`,
      '',
    ]),
  ].join('\n');
  await fs.writeFile(path.join(output, 'chapters-vi.vtt'), vtt);
  console.log(
    `Captured ${report.screenshots.length} images and desktop video.`,
  );
} catch (error) {
  report.passed = false;
  report.errors.push(error.stack);
  console.error(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(output, 'capture-report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
