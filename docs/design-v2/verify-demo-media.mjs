/* global document */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('docs/design-v2/demo-media-20261023');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1664, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto('http://127.0.0.1:8766/');
await expect(page.locator('#chapters button')).toHaveCount(9);
await page.locator('img').evaluateAll(async (images) => {
  await Promise.all(images.map((image) => image.decode()));
});
await expect
  .poll(() =>
    page
      .locator('img')
      .evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0),
      ),
  )
  .toBe(true);
await page.addStyleTag({ content: 'main{max-width:1664px}' });
await page
  .locator('#mobile-board')
  .screenshot({ path: path.join(output, '19-mobile-overview.png') });
await page.addStyleTag({ content: 'main{max-width:1240px}' });
const video = page.locator('#demo');
await expect
  .poll(() => video.evaluate((element) => element.readyState))
  .toBeGreaterThanOrEqual(1);
const media = await video.evaluate(async (element) => {
  await element.play();
  await new Promise((resolve) =>
    element.addEventListener('timeupdate', resolve, { once: true }),
  );
  element.pause();
  return {
    width: element.videoWidth,
    height: element.videoHeight,
    duration: element.duration,
    currentTime: element.currentTime,
    error: element.error?.message ?? null,
  };
});
expect(media.width).toBe(1440);
expect(media.height).toBe(1000);
expect(media.currentTime).toBeGreaterThan(0);
expect(media.error).toBe(null);
const report = JSON.parse(
  await fs.readFile(path.join(output, 'capture-report.json'), 'utf8'),
);
const samples = [0, 2, 5, 7];
for (const index of samples) {
  const time = report.chapters[index].time + 1.5;
  await video.evaluate(async (element, value) => {
    element.currentTime = value;
    await new Promise((resolve) =>
      element.addEventListener('seeked', resolve, { once: true }),
    );
  }, time);
  const base64 = await video.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext('2d').drawImage(element, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await fs.writeFile(
    path.join(output, `video-frame-${index}.png`),
    Buffer.from(base64, 'base64'),
  );
}
await page.getByRole('button', { name: /Xem trước tác động tồn kho/ }).click();
await expect
  .poll(() => video.evaluate((element) => element.currentTime))
  .toBeGreaterThanOrEqual(report.chapters[5].time);
await video.evaluate((element) => element.play());
await video.evaluate((element) => element.pause());
await page.waitForTimeout(100);
expect(errors).toEqual([]);
const result = {
  passed: true,
  imageCount: await page.locator('img').count(),
  media,
  bytes: (await fs.stat(path.join(output, 'stockpilot-atlas-desktop.webm')))
    .size,
  chapterCount: report.chapters.length,
  errors,
};
await fs.writeFile(
  path.join(output, 'media-qa.json'),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
await browser.close();
