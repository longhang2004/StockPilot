'use client';

import {
  Archive,
  ClipboardText,
  Cube,
  GearSix,
  House,
  Package,
  PlugsConnected,
  Receipt,
  UsersThree,
} from '@phosphor-icons/react';
import type { Role } from '@stockpilot/contracts';
import Link from 'next/link';

import type { WorkspaceSection } from './workspace-content';

export interface SessionView {
  membership: {
    organization: {
      currency: string;
      name: string;
      isDemo?: boolean;
    };
    role: Role;
  };
  user: {
    displayName: string;
    email?: string;
  };
}

const navigation: Array<{
  label: string;
  href: string;
  icon: typeof House;
}> = [
  { label: 'Overview', href: '/app', icon: House },
  { label: 'Orders', href: '/app/orders', icon: ClipboardText },
  { label: 'Inventory', href: '/app/inventory', icon: Cube },
  { label: 'Products', href: '/app/products', icon: Package },
  { label: 'Partners', href: '/app/partners', icon: UsersThree },
  { label: 'Receipts', href: '/app/receipts', icon: Receipt },
  { label: 'Imports', href: '/app/imports', icon: Archive },
  { label: 'Integrations', href: '/app/integrations', icon: PlugsConnected },
  { label: 'Audit', href: '/app/audit', icon: GearSix },
];

const roleLabels: Record<Role, string> = {
  MANAGER: 'Manager',
  OWNER: 'Owner',
  STAFF: 'Staff',
};

function isActive(href: string, section: WorkspaceSection): boolean {
  if (href === '/app') return section === 'overview';
  return href === `/app/${section}`;
}

export function WorkspaceSidebar({
  section,
  session,
}: {
  section: WorkspaceSection;
  session: SessionView;
}) {
  const initials = session.user.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return (
    <aside className="workspace-sidebar">
      <Link className="brand workspace-brand" href="/app">
        <span className="brand-mark" aria-hidden="true">
          SP
        </span>
        <span>StockPilot</span>
      </Link>
      <div className="organization-switcher">
        <span>Organization</span>
        <strong>{session.membership.organization.name}</strong>
        <small>
          Main Warehouse · {session.membership.organization.currency}
        </small>
      </div>
      <nav aria-label="Workspace navigation">
        {navigation.map(({ href, icon: Icon, label }) => (
          <Link
            aria-current={isActive(href, section) ? 'page' : undefined}
            className={`workspace-nav-link${isActive(href, section) ? ' workspace-nav-active' : ''}`}
            href={href}
            key={href}
          >
            <Icon size={18} weight="regular" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="workspace-user">
        <span className="user-avatar" aria-hidden="true">
          {initials}
        </span>
        <span>
          <strong>{session.user.displayName}</strong>
          <small>{roleLabels[session.membership.role]}</small>
        </span>
      </div>
    </aside>
  );
}

export function MobileWorkspaceNavigation({
  section,
}: {
  section: WorkspaceSection;
}) {
  return (
    <nav
      className="mobile-workspace-nav"
      aria-label="Mobile workspace navigation"
    >
      {navigation.slice(0, 3).map(({ href, icon: Icon, label }) => (
        <Link
          aria-current={isActive(href, section) ? 'page' : undefined}
          className={isActive(href, section) ? 'mobile-nav-active' : undefined}
          href={href}
          key={href}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      <Link
        aria-current={section === 'more' ? 'page' : undefined}
        href="/app/more"
      >
        <GearSix size={19} aria-hidden="true" />
        <span>More</span>
      </Link>
    </nav>
  );
}
