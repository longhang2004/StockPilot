import { expect, test } from '@playwright/test';

test.describe('public SEO surface', () => {
  test('homepage exposes crawlable metadata and no horizontal overflow', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(
      'StockPilot — Inventory & B2B Order Operations Demo',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /inventory and B2B order operations demo/i,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https?:\/\/[^/]+\/?$/,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Inventory & B2B Order Operations Demo/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );

    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(jsonLd).toContain('WebSite');
    expect(jsonLd).toContain('WebPage');

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });

  test('robots and sitemap are public while demo routes are noindex', async ({
    page,
    request,
  }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain('/sitemap.xml');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('<loc>');
    expect(sitemapText).not.toContain('/login');
    expect(sitemapText).not.toContain('/app');

    for (const route of ['/login', '/app']) {
      await page.goto(route);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex, nofollow/,
      );
    }
  });

  test('keeps the marketing surface within the viewport at target widths', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    for (const width of [375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(
        dimensions.clientWidth,
      );
    }
  });

  test('keeps the skip link and primary CTA keyboard reachable', async ({
    page,
  }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();

    const primaryCta = page.getByRole('link', {
      name: 'Explore manager demo',
    });
    await primaryCta.first().focus();
    await expect(primaryCta.first()).toBeFocused();
  });
});
