import type { MetadataRoute } from 'next';

import { siteOrigin } from '../lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteOrigin,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
