'use client';

import { ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';

const steps: Array<{ href: string; label: string; detail: string }> = [
  {
    detail: 'Open the seeded draft and see the multi-line snapshot.',
    href: '/app/orders?status=DRAFT',
    label: 'Review a draft B2B order',
  },
  {
    detail: 'Confirm it as Manager and watch stock become reserved.',
    href: '/app/inventory',
    label: 'Confirm and reserve inventory',
  },
  {
    detail: 'Use the demo role switcher, then fulfill the confirmed order.',
    href: '/app/orders?status=CONFIRMED',
    label: 'Switch to Staff and fulfill',
  },
  {
    detail: 'Inspect the actor and before/after state of every mutation.',
    href: '/app/audit',
    label: 'Inspect the audit trail',
  },
];

/**
 * Demo-only quick guide: four clickable deep links that walk a reviewer
 * through the core StockPilot workflow in about a minute. Rendered only for
 * the canonical demo workspace.
 */
export function DemoQuickGuide() {
  return (
    <article className="guidance-card demo-guide" aria-label="Try StockPilot">
      <p className="eyebrow">Try StockPilot</p>
      <ol className="demo-guide-steps">
        {steps.map((step) => (
          <li key={step.label}>
            <Link href={step.href}>
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </article>
  );
}
