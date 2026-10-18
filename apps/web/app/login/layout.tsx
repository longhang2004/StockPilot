import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to a StockPilot workspace or open the demo.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
