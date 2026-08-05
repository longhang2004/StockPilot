import type { MetadataRoute } from 'next';

import { siteOrigin } from '../lib/site-config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StockPilot — Inventory & B2B Order Operations',
    short_name: 'StockPilot',
    description:
      'A calm, ledger-backed workspace for wholesale inventory and B2B order operations.',
    start_url: siteOrigin,
    scope: '/',
    display: 'standalone',
    background_color: '#F2F0EA',
    theme_color: '#F2F0EA',
    icons: [
      {
        src: '/icon',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
