import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create workspace',
  description: 'Create your StockPilot workspace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateWorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
