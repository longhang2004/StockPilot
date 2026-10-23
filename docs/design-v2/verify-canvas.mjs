// Run against the prototype-only localhost server on port 8765.
/* global document, window */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
// Keep the native query available so the test can drive its preference-change event.
await context.addInitScript(() => {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => {
    const media = original(query);
    if (query === '(prefers-reduced-motion: reduce)')
      window.motionTestQuery = media;
    return media;
  };
});
const page = await context.newPage();
const report = { viewports: [], motion: [], accessibility: [], errors: [] };
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400)
    report.errors.push(`${response.status()} ${response.url()}`);
});
const go = (concept) =>
  page.goto(`http://127.0.0.1:8765/?preview=${concept}&surface=landing`);
const motionPreference = async (value) => {
  await page.emulateMedia({ reducedMotion: value });
  // Emulation updates matches here without emitting the OS preference event.
  await page.evaluate(() =>
    window.motionTestQuery?.dispatchEvent(new window.Event('change')),
  );
};
const pixels = async () =>
  createHash('sha256')
    .update(
      await page.locator('canvas').evaluate((canvas) => canvas.toDataURL()),
    )
    .digest('hex');

try {
  for (const concept of ['atlas', 'relay', 'folio']) {
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await go(concept);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const dimensions = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const data = canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]) painted++;
        return {
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
          canvasWidth: canvas.width,
          sceneWidth: canvas.parentElement.clientWidth,
          painted,
          background:
            canvas.closest('.hero-map')?.getAttribute('aria-hidden') === 'true',
          mapPosition: window.getComputedStyle(canvas.parentElement).position,
          mapLayer: window.getComputedStyle(canvas.parentElement).zIndex,
          contentLayer: window.getComputedStyle(
            document.querySelector('.hero-content'),
          ).zIndex,
        };
      });
      assert(
        dimensions.scroll <= dimensions.client + 1,
        `${concept}/${width} overflow`,
      );
      assert.equal(dimensions.canvasWidth, dimensions.sceneWidth);
      assert.equal(dimensions.background, true);
      assert.equal(dimensions.mapPosition, 'absolute');
      assert(
        Number(dimensions.mapLayer) < Number(dimensions.contentLayer),
        'Map must sit beneath the hero content',
      );
      assert.equal(
        await page.locator('.stock-flow').count(),
        0,
        'No standalone animation panel',
      );
      const heroBox = await page.locator('.landing-hero').boundingBox();
      const canvasBox = await page.locator('canvas').boundingBox();
      assert.equal(canvasBox.width, width);
      assert(Math.abs(canvasBox.height - heroBox.height) < 1);
      for (const cta of await page.locator('.landing-actions a').all()) {
        const bounds = await cta.boundingBox();
        assert(
          bounds.x >= 0 && bounds.x + bounds.width <= width,
          'Hero CTA must remain fully in view',
        );
      }
      assert(
        dimensions.painted > 1000,
        'Canvas must actually draw visible content',
      );
      const toggle = page.getByRole('button', {
        name: 'Pause logistics animation',
      });
      const box = await toggle.boundingBox();
      assert(
        box.width >= 44 &&
          box.height >= 44 &&
          box.x >= 0 &&
          box.x + box.width <= width,
      );
      assert(await page.getByRole('heading', { level: 1 }).isVisible());
      assert(
        await page
          .getByRole('link', { name: 'Explore the workspace' })
          .isVisible(),
      );
      report.viewports.push({ concept, width, ...dimensions });

      if (width === 1440 || width === 390) {
        await page.screenshot({
          path: `${output}map-${concept}-${width === 1440 ? 'desktop' : 'mobile'}.png`,
        });
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        report.accessibility.push({
          concept,
          width,
          violations: audit.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        });
        assert.equal(
          audit.violations.length,
          0,
          `${concept}/${width} accessibility`,
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go(concept);
    await page.waitForTimeout(180);
    let first = await pixels();
    const heroBox = await page.locator('.landing-hero').boundingBox();
    const clip = {
      x: 0,
      y: Math.ceil(heroBox.y + heroBox.height * 0.17),
      width: 300,
      height: Math.floor(heroBox.height * 0.6),
    };
    const renderedBefore = await page.screenshot({ clip });
    await page.waitForTimeout(450);
    const renderedAfter = await page.screenshot({ clip });
    assert(
      !renderedBefore.equals(renderedAfter),
      'Visible map shipments must move beneath the hero',
    );
    assert.notEqual(
      await pixels(),
      first,
      `${concept}: motion must change actual pixels`,
    );
    await page
      .getByRole('button', { name: 'Pause logistics animation' })
      .focus();
    await page.keyboard.press('Space');
    const play = page.getByRole('button', {
      name: 'Play logistics animation',
    });
    assert(await play.isVisible());
    first = await pixels();
    await page.mouse.move(20, 200);
    await page.waitForTimeout(350);
    assert.equal(
      await pixels(),
      first,
      `${concept}: pause must freeze pixels, including pointer movement`,
    );
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    assert.notEqual(
      await pixels(),
      first,
      `${concept}: keyboard resume must restart motion`,
    );

    await page.locator('.landing-footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    first = await pixels();
    await page.waitForTimeout(350);
    assert.equal(
      await pixels(),
      first,
      `${concept}: offscreen hero must stop drawing`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    assert.notEqual(
      await pixels(),
      first,
      `${concept}: returning to hero must resume`,
    );

    await motionPreference('reduce');
    await page.waitForFunction(
      () => document.querySelector('.motion-toggle').hidden,
    );
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.motion-toggle').isVisible(), false);
    first = await pixels();
    await page.mouse.move(800, 240);
    await page.waitForTimeout(350);
    assert.equal(
      await pixels(),
      first,
      `${concept}: reduced motion must stay static`,
    );
    await motionPreference('no-preference');
    await page.waitForTimeout(250);
    assert.notEqual(
      await pixels(),
      first,
      `${concept}: preference change must resume`,
    );
    report.motion.push({
      concept,
      animated: true,
      visibleBackgroundMotion: true,
      keyboardPauseResume: true,
      pointerPaused: true,
      offscreenPauseResume: true,
      reducedMotion: true,
      emulatedPreferenceChangeEvent: true,
    });
  }

  // A fresh reduced-motion load should never start moving.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await go('atlas');
  await page.waitForTimeout(180);
  const still = await pixels();
  await page.waitForTimeout(350);
  assert.equal(await pixels(), still);
  report.initialReducedMotion = true;
  const retinaContext = await browser.newContext({ deviceScaleFactor: 3 });
  const retina = await retinaContext.newPage();
  await retina.goto('http://127.0.0.1:8765/?preview=atlas&surface=landing');
  await retina.waitForTimeout(150);
  const density = await retina
    .locator('canvas')
    .evaluate((c) => c.width / c.parentElement.clientWidth);
  assert.equal(density, 2, 'Canvas drawing density is capped at 2x');
  report.dprCap = density;
  await retinaContext.close();

  // Decorative drawing must not be required to use the landing.
  await page.addInitScript(() => {
    window.HTMLCanvasElement.prototype.getContext = () => null;
  });
  await go('atlas');
  assert(await page.getByRole('heading', { level: 1 }).isVisible());
  assert.equal(await page.locator('.motion-toggle').isVisible(), false);
  assert.equal(await page.locator('canvas').isVisible(), false);
  await page.getByRole('link', { name: 'Explore the workspace' }).click();
  await page.locator('.app-main').waitFor();
  report.noCanvasFallback = true;
  assert.deepEqual(report.errors, []);
  fs.writeFileSync(
    `${output}map-qa.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      viewports: report.viewports.length,
      motion: report.motion.length,
      axe: report.accessibility.length,
      initialReducedMotion: report.initialReducedMotion,
      dprCap: report.dprCap,
      noCanvasFallback: report.noCanvasFallback,
      errors: report.errors,
    }),
  );
} finally {
  await browser.close();
}
