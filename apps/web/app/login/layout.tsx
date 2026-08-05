import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Demo login',
  description:
    'Choose a StockPilot demo role and explore the seeded workspace.',
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
