import type { NextConfig } from 'next';

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
].join(' ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptSources}; connect-src 'self' https://*.sentry.io; font-src 'self' data:`,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
        source: '/(.*)',
      },
    ];
  },
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
