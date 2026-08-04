'use client';

import type { Role } from '@stockpilot/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SessionView {
  membership: {
    organization: {
      currency: string;
      name: string;
    };
    role: Role;
  };
  user: {
    displayName: string;
  };
}

const navigation = [
  ['Overview', '/app'],
  ['Orders', '/app/orders'],
  ['Inventory', '/app/inventory'],
  ['Products', '/app/products'],
  ['Partners', '/app/partners'],
  ['Receipts', '/app/receipts'],
  ['Imports', '/app/imports'],
  ['Integrations', '/app/integrations'],
  ['Audit', '/app/audit'],
] as const;

const roleLabels: Record<Role, string> = {
  MANAGER: 'Manager',
  OWNER: 'Owner',
  STAFF: 'Staff',
};

export function WorkspaceShell() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'expired'>(
    'loading',
  );

  useEffect(() => {
    let active = true;

    async function loadSession(): Promise<void> {
      try {
        const response = await fetch('/api/v1/auth/session', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Session unavailable.');
        }
        const body = (await response.json()) as SessionView;
        if (active) {
          setSession(body);
          setState('ready');
        }
      } catch {
        if (active) {
          setState('expired');
        }
      }
    }

    void loadSession();
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

  return (
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
          <small>Main Warehouse</small>
        </div>
        <nav aria-label="Workspace navigation">
          {navigation.map(([label, href], index) => (
            <Link
              key={href}
              className={`workspace-nav-link${index === 0 ? ' workspace-nav-active' : ''}`}
              href={href}
            >
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace-user">
          <span className="user-avatar" aria-hidden="true">
            {session.user.displayName
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </span>
          <span>
            <strong>{session.user.displayName}</strong>
            <small>{roleLabels[session.membership.role]}</small>
          </span>
        </div>
      </aside>

      <main className="workspace-main">
        <div className="demo-banner">
          <span>Demo workspace</span>
          Data resets every six hours. Changes are safe to explore.
        </div>
        <header className="workspace-header">
          <div>
            <p>Tuesday · Main Warehouse</p>
            <h1>Operations overview</h1>
          </div>
          <button className="secondary-button" type="button">
            Create order
          </button>
        </header>

        <section className="workspace-stats" aria-label="Operational summary">
          <article>
            <span>Orders awaiting approval</span>
            <strong>3</strong>
            <small>One order is high priority</small>
          </article>
          <article>
            <span>Low-stock products</span>
            <strong>4</strong>
            <small>Two are below safety stock</small>
          </article>
          <article>
            <span>Open order value</span>
            <strong>$18,420</strong>
            <small>12 active orders</small>
          </article>
          <article>
            <span>Integration failures</span>
            <strong>1</strong>
            <small>Unknown SKU needs review</small>
          </article>
        </section>

        <section className="workspace-panels">
          <article className="work-panel">
            <div className="panel-heading">
              <div>
                <p className="kicker">Needs attention</p>
                <h2>Priority work queue</h2>
              </div>
              <button type="button">View all</button>
            </div>
            <div className="work-row">
              <span className="severity severity-high">Low stock</span>
              <span>
                <strong>Organic Oat Milk · 12 pack</strong>
                <small>4 available · reorder point 16</small>
              </span>
              <button type="button">Receive stock</button>
            </div>
            <div className="work-row">
              <span className="severity severity-medium">Approval</span>
              <span>
                <strong>SO-1048 · Northstar Market</strong>
                <small>$2,860 · 8 line items</small>
              </span>
              <button type="button">Review order</button>
            </div>
            <div className="work-row">
              <span className="severity severity-neutral">Import</span>
              <span>
                <strong>Storefront order needs review</strong>
                <small>Unknown SKU at line 3</small>
              </span>
              <button type="button">Inspect event</button>
            </div>
          </article>

          <article className="work-panel recent-panel">
            <div className="panel-heading">
              <div>
                <p className="kicker">Recent activity</p>
                <h2>Stock movements</h2>
              </div>
            </div>
            <div className="movement-row">
              <span className="movement-positive">+48</span>
              <span>
                <strong>Cold Brew Concentrate</strong>
                <small>Receipt RC-0231 · 9:42 AM</small>
              </span>
            </div>
            <div className="movement-row">
              <span className="movement-negative">−12</span>
              <span>
                <strong>Organic Oat Milk</strong>
                <small>Order SO-1042 · 9:18 AM</small>
              </span>
            </div>
            <div className="movement-row">
              <span className="movement-positive">+6</span>
              <span>
                <strong>Roasted Almond Butter</strong>
                <small>Adjustment · 8:55 AM</small>
              </span>
            </div>
          </article>
        </section>
      </main>

      <nav
        className="mobile-workspace-nav"
        aria-label="Mobile workspace navigation"
      >
        {navigation.slice(0, 3).map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <Link href="/app/more">More</Link>
      </nav>
    </div>
  );
}
