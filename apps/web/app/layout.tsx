import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { siteName, siteUrl } from '../lib/site-config';
import './globals.css';

const sourceSans = localFont({
  src: './fonts/source-sans-3-vf.woff2',
  weight: '200 900',
  variable: '--font-source-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteName,
  title: {
    default: siteName,
    template: '%s | StockPilot',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png', sizes: '64x64' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-icon',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#F3F6F8',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={sourceSans.variable}>{children}</body>
    </html>
  );
}
