import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Sign up for a StockPilot workspace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
