import type { MetadataRoute } from 'next';

import { siteOrigin } from '../lib/site-config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StockPilot — Inventory & B2B Order Operations',
    short_name: 'StockPilot',
    description:
      'A role-aware workspace for wholesale inventory and B2B order operations.',
    start_url: siteOrigin,
    scope: '/',
    display: 'standalone',
    background_color: '#F6F7F5',
    theme_color: '#F6F7F5',
    icons: [
      {
        src: '/icon',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
