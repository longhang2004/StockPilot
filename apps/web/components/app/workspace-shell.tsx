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
import { useEffect, useState } from 'react';

import { QueryProvider } from '../../lib/query-provider';
import { WorkspaceContent, type WorkspaceSection } from './workspace-content';

export type { WorkspaceSection };

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

export function WorkspaceShell({
  section = 'overview',
}: {
  section?: WorkspaceSection;
}) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'expired'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    void fetch('/api/v1/auth/session', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session unavailable.');
        const body = (await response.json()) as SessionView;
        if (active) {
          setSession(body);
          setState('ready');
        }
      })
      .catch(() => {
        if (active) setState('expired');
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') {
    return (
      <main className="workspace-loading" aria-live="polite">
        <span className="loading-mark" aria-hidden="true">
          SP
        </span>
        <p>Preparing the wholesale workspace…</p>
      </main>
    );
  }

  if (state === 'expired' || !session) {
    return (
      <main className="session-expired">
        <div>
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <p className="kicker">Authentication required</p>
          <h1>Your demo session has expired.</h1>
          <p role="alert">
            Your session has expired. Start a fresh role-based session to
            continue exploring StockPilot.
          </p>
          <Link className="button button-primary" href="/login">
            Return to demo login <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
    );
  }

  const initials = session.user.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
  return (
    <QueryProvider>
      <div className="workspace">
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
        <main className="workspace-main">
          <div className="demo-banner">
            <span>Demo workspace</span>Data resets every six hours. Changes are
            safe to explore.
          </div>
          <WorkspaceContent section={section} session={session} />
        </main>
        <nav
          className="mobile-workspace-nav"
          aria-label="Mobile workspace navigation"
        >
          {navigation.slice(0, 3).map(({ href, icon: Icon, label }) => (
            <Link
              aria-current={isActive(href, section) ? 'page' : undefined}
              className={
                isActive(href, section) ? 'mobile-nav-active' : undefined
              }
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
      </div>
    </QueryProvider>
  );
}

function isActive(href: string, section: WorkspaceSection): boolean {
  if (href === '/app') return section === 'overview';
  return href === `/app/${section}`;
}
