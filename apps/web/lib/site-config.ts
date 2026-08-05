const defaultSiteUrl = 'http://localhost:3000';

const configuredSiteUrl = process.env.SITE_URL?.trim();

if (process.env.NODE_ENV === 'production' && !configuredSiteUrl) {
  throw new Error(
    'SITE_URL must be configured for production metadata, robots, sitemap, and JSON-LD.',
  );
}

export const siteUrl = new URL(configuredSiteUrl || defaultSiteUrl);
export const siteOrigin = siteUrl.origin;

export const siteName = 'StockPilot';
export const siteDescription =
  'Explore a working inventory and B2B order operations demo with ledger-backed stock, role-aware workflows, and overselling protection.';

export const homepageTitle =
  'StockPilot — Inventory & B2B Order Operations Demo';
