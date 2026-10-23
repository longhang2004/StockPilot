'use client';

import { ArrowRight } from '@phosphor-icons/react';
import type { Role } from '@stockpilot/contracts';
import Link from 'next/link';

function stepsForRole(
  role: Role,
): Array<{ href: string; label: string; detail: string }> {
  if (role === 'STAFF') {
    return [
      {
        detail: 'Prepare a draft and leave confirmation to a Manager or Owner.',
        href: '/app/orders?status=DRAFT',
        label: 'Prepare a draft order',
      },
      {
        detail: 'Fulfill an order that has already been confirmed.',
        href: '/app/orders?status=CONFIRMED',
        label: 'Fulfill confirmed demand',
      },
      {
        detail: 'Review the stock position and low-stock items.',
        href: '/app/inventory',
        label: 'Review inventory',
      },
    ];
  }
  return [
    {
      detail: 'Open a seeded draft and review its customer and line items.',
      href: '/app/orders?status=DRAFT',
      label: 'Review a draft order',
    },
    {
      detail: 'Confirm it to reserve stock for the customer.',
      href: '/app/orders?status=DRAFT',
      label: 'Confirm and reserve inventory',
    },
    {
      detail: 'Switch to Staff and fulfill the confirmed order.',
      href: '/app/orders?status=CONFIRMED',
      label: 'Fulfill confirmed demand',
    },
    {
      detail: 'Review the actor and change history for a record.',
      href: '/app/audit',
      label: 'Review the audit trail',
    },
  ];
}

/**
 * Demo-only quick guide: four clickable deep links that walk a reviewer
 * through the core StockPilot workflow in about a minute. Rendered only for
 * the canonical demo workspace.
 */
export function DemoQuickGuide({ role }: { role: Role }) {
  const steps = stepsForRole(role);
  return (
    <details className="guidance-card demo-guide">
      <summary>Try StockPilot · A quick workflow guide</summary>
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
    </details>
  );
}
