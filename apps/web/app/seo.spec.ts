import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { metadata as homepageMetadata } from './page';
import { metadata as workspaceMetadata } from './app/layout';
import { metadata as loginMetadata } from './login/layout';
import manifest from './manifest';
import robots from './robots';
import sitemap from './sitemap';

describe('public SEO contract', () => {
  it('defines indexable homepage metadata without keyword stuffing', () => {
    expect(homepageMetadata.alternates?.canonical).toBe('/');
    expect(homepageMetadata.description).toMatch(
      /inventory and B2B order operations/i,
    );
    expect(homepageMetadata.openGraph).toMatchObject({
      type: 'website',
      locale: 'en_US',
    });
    expect(homepageMetadata.twitter).toMatchObject({
      card: 'summary_large_image',
    });
    expect(homepageMetadata).not.toHaveProperty('keywords');
  });

  it('keeps demo routes out of the index', () => {
    expect(loginMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(workspaceMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('publishes only the public origin and real product images', () => {
    const sitemapEntries = sitemap();
    const imageUrls = sitemapEntries[0]?.images ?? [];

    expect(sitemapEntries).toHaveLength(1);
    expect(sitemapEntries[0]?.url).toMatch(/^https?:\/\//);
    expect(imageUrls).toHaveLength(4);
    expect(imageUrls.every((url) => url.includes('/assets/'))).toBe(true);

    const robotsFile = robots();
    expect(robotsFile.rules).toMatchObject({ userAgent: '*', allow: '/' });
    expect(robotsFile.sitemap).toMatch(/\/sitemap\.xml$/);
    expect(robotsFile.host).toMatch(/^https?:\/\//);
  });

  it('exposes a branded manifest without authenticated start routes', () => {
    const appManifest = manifest();

    expect(appManifest.name).toMatch(/StockPilot/);
    expect(appManifest.start_url).toBeTruthy();
    expect(appManifest.start_url).not.toMatch(/\/app/);
    expect(appManifest.theme_color).toBe('#F2F0EA');
  });

  it('serializes safe WebSite and WebPage JSON-LD', async () => {
    const { default: HomePage } = await import('./page');
    const { container } = render(createElement(HomePage));
    const jsonLd = container.querySelector(
      'script[type="application/ld+json"]',
    )?.textContent;

    expect(jsonLd).toContain('WebSite');
    expect(jsonLd).toContain('WebPage');
    expect(jsonLd).not.toContain('</script>');
    // StockPilot is a portfolio/demo project: no organization entity and no
    // fabricated application offers/ratings in the structured data.
    expect(jsonLd).not.toContain('SoftwareApplication');
    expect(jsonLd).not.toContain('"Organization"');
    expect(jsonLd).not.toContain('aggregateRating');
    expect(jsonLd).not.toContain('offers');
  });
});
