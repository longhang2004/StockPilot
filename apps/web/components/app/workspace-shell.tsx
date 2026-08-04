'use client';

import type { Role } from '@stockpilot/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { WorkspaceContent } from './workspace-content';

export type WorkspaceSection =
  | 'audit'
  | 'imports'
  | 'integrations'
  | 'inventory'
  | 'more'
  | 'orders'
  | 'partners'
  | 'products'
  | 'receipts'
  | 'settings';

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

interface DashboardOverview {
  exceptions?: {
    failedIntegrations?: number;
    openLowStockAlerts?: number;
    ordersAwaitingApproval?: number;
  };
  openOrderValue?: string;
  recentMovements?: Array<{
    createdAt: string;
    product?: { name: string; sku: string };
    quantityDelta: number;
    type: string;
  }>;
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

export function WorkspaceShell({
  section = 'overview',
}: {
  section?: WorkspaceSection | 'overview';
}) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
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
        try {
          const overviewResponse = await fetch('/api/v1/dashboard/overview', {
            credentials: 'include',
          });
          if (overviewResponse.ok && active) {
            setOverview((await overviewResponse.json()) as DashboardOverview);
          }
        } catch {
          // The shell remains useful when the optional dashboard request is unavailable.
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
              className={`workspace-nav-link${isActive(href, section) ? ' workspace-nav-active' : ''}`}
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
        {section === 'overview' ? (
          <>
            <header className="workspace-header">
              <div>
                <p>Tuesday · Main Warehouse</p>
                <h1>Operations overview</h1>
              </div>
              <Link className="secondary-button" href="/app/orders?new=1">
                Create order
              </Link>
            </header>

            <section
              className="workspace-stats"
              aria-label="Operational summary"
            >
              <article>
                <span>Orders awaiting approval</span>
                <strong>
                  {overview?.exceptions?.ordersAwaitingApproval ?? 0}
                </strong>
                <small>Draft orders need a Manager</small>
              </article>
              <article>
                <span>Low-stock products</span>
                <strong>{overview?.exceptions?.openLowStockAlerts ?? 0}</strong>
                <small>Open alerts in Main Warehouse</small>
              </article>
              <article>
                <span>Open order value</span>
                <strong>${overview?.openOrderValue ?? '0.00'}</strong>
                <small>Draft and confirmed orders</small>
              </article>
              <article>
                <span>Integration failures</span>
                <strong>{overview?.exceptions?.failedIntegrations ?? 0}</strong>
                <small>Delivery retries need review</small>
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
                    <strong>
                      {overview?.exceptions?.openLowStockAlerts ?? 0} products
                      below reorder point
                    </strong>
                    <small>Receive stock to resolve an alert</small>
                  </span>
                  <Link href="/app/receipts">Receive stock</Link>
                </div>
                <div className="work-row">
                  <span className="severity severity-medium">Approval</span>
                  <span>
                    <strong>
                      {overview?.exceptions?.ordersAwaitingApproval ?? 0} draft
                      orders
                    </strong>
                    <small>Review before reservation</small>
                  </span>
                  <Link href="/app/orders?status=DRAFT">Review orders</Link>
                </div>
                <div className="work-row">
                  <span className="severity severity-neutral">Import</span>
                  <span>
                    <strong>
                      {overview?.exceptions?.failedIntegrations ?? 0}{' '}
                      integration failures
                    </strong>
                    <small>Inspect delivery history and retry safely</small>
                  </span>
                  <Link href="/app/integrations">Inspect events</Link>
                </div>
              </article>

              <article className="work-panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <p className="kicker">Recent activity</p>
                    <h2>Stock movements</h2>
                  </div>
                </div>
                {(overview?.recentMovements ?? []).length > 0 ? (
                  overview?.recentMovements?.map((movement) => (
                    <div
                      className="movement-row"
                      key={`${movement.createdAt}-${movement.type}-${movement.product?.sku}`}
                    >
                      <span
                        className={
                          movement.quantityDelta >= 0
                            ? 'movement-positive'
                            : 'movement-negative'
                        }
                      >
                        {movement.quantityDelta >= 0 ? '+' : '−'}
                        {Math.abs(movement.quantityDelta)}
                      </span>
                      <span>
                        <strong>
                          {movement.product?.name ?? 'Unknown product'}
                        </strong>
                        <small>
                          {movement.type} ·{' '}
                          {new Date(movement.createdAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </small>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-activity">No stock movements yet.</div>
                )}
              </article>
            </section>
          </>
        ) : (
          <WorkspaceContent section={section} />
        )}
      </main>

      <nav
        className="mobile-workspace-nav"
        aria-label="Mobile workspace navigation"
      >
        {navigation.slice(0, 3).map(([label, href]) => (
          <Link
            className={
              isActive(href, section) ? 'mobile-nav-active' : undefined
            }
            key={href}
            href={href}
          >
            {label}
          </Link>
        ))}
        <Link href="/app/more">More</Link>
      </nav>
    </div>
  );
}

function isActive(
  href: string,
  section: WorkspaceSection | 'overview',
): boolean {
  if (href === '/app') return section === 'overview';
  return href === `/app/${section}`;
}
