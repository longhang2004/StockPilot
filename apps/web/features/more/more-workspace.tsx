'use client';

import { ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';

import { DemoRoleSwitcher } from '../../components/app/workspace-navigation';
import { PageHeader } from '../../components/ui/operations-ui';
import type { WorkspaceSessionView } from '../shared/types';

export function MoreWorkspace({ session }: { session: WorkspaceSessionView }) {
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
      {session.membership.organization.isDemo ? (
        <DemoRoleSwitcher compact currentRole={session.membership.role} />
      ) : null}
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
