import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Demo workspace',
  description: 'The authenticated StockPilot operations demo workspace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
