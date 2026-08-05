import type { MetadataRoute } from 'next';

import { siteOrigin } from '../lib/site-config';

const publicImages = [
  'overview-desktop.png',
  'inventory-desktop.png',
  'orders-mobile.png',
  'receipt-drawer-mobile.png',
].map((filename) => `${siteOrigin}/assets/${filename}`);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteOrigin,
      changeFrequency: 'monthly',
      priority: 1,
      images: publicImages,
    },
  ];
}
