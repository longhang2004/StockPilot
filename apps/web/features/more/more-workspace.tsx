'use client';

import { ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';

import { PageHeader } from '../../components/ui/operations-ui';

export function MoreWorkspace() {
  const links = [
    ['Products', '/app/products'],
    ['Partners', '/app/partners'],
    ['Receipts', '/app/receipts'],
    ['Imports', '/app/imports'],
    ['Integrations', '/app/integrations'],
    ['Audit', '/app/audit'],
    ['Owner settings', '/app/settings'],
  ] as const;
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Keep the mobile queue focused, then reach supporting workflows here."
        title="More operations"
      />
      <div className="more-grid">
        {links.map(([label, href]) => (
          <Link className="more-link" href={href} key={href}>
            <strong>{label}</strong>
            <ArrowRight size={17} />
          </Link>
        ))}
      </div>
    </section>
  );
}
