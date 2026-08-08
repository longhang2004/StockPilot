import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Accept invitation',
  description: 'Join a StockPilot workspace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AcceptInvitationLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
