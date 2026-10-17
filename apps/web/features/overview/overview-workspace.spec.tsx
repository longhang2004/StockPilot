import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../lib/query-provider';
import { OverviewWorkspace } from './overview-workspace';
import type { WorkspaceSessionView } from '../shared/types';

const managerSession: WorkspaceSessionView = {
  membership: {
    id: 'membership-1',
    organization: {
      currency: 'USD',
      id: 'org-1',
      isDemo: true,
      name: 'Harbor & Pine Wholesale',
      nextDemoResetAt: null,
      slug: 'stockpilot-demo',
    },
    role: 'MANAGER',
  },
  user: {
    displayName: 'Morgan Manager',
    email: 'manager@example.test',
    id: 'user-1',
  },
};

function stubFetch(overviewBody: unknown, analyticsBody?: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/dashboard/overview')) {
        return Promise.resolve(
          new Response(JSON.stringify(overviewBody), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        );
      }
      if (url.includes('/analytics')) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              analyticsBody ?? {
                averageFulfilledOrderValue: '0.00',
                fulfilledOrderCount: 0,
                fulfilledOrderValue: '0.00',
                lowStockSkuCount: 0,
                ordersByStatus: [],
                topFulfilledProducts: [],
              },
            ),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ items: [], page: 1, pageSize: 25, total: 0 }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          },
        ),
      );
    }),
  );
}

describe('OverviewWorkspace movement summary', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the 14-day inbound/outbound rows from fourteenDayMovements', async () => {
    stubFetch({
      exceptions: {
        failedIntegrations: 0,
        openLowStockAlerts: 0,
        ordersAwaitingApproval: 1,
      },
      fourteenDayMovements: [
        { day: '2026-08-01', inbound: 120, outbound: 40 },
        { day: '2026-08-02', inbound: 60, outbound: 75 },
      ],
      openOrderValue: '122.25',
      recentMovements: [],
      recentOrders: [],
    });

    const view = render(
      <QueryProvider>
        <OverviewWorkspace session={managerSession} />
      </QueryProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Inbound and outbound units',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('img', {
        name: /Inbound and outbound units per day over the last 2 days/,
      }),
    ).toBeVisible();
    // The accessible table summary lives behind the disclosure.
    fireEvent.click(screen.getByText('Show table summary'));
    expect(screen.getByText('+120')).toBeVisible();
    expect(screen.getByText('−40')).toBeVisible();
    expect(screen.getByText('+60')).toBeVisible();
    expect(screen.getByText('−75')).toBeVisible();
    view.unmount();
  });

  it('does not trust the legacy inboundOutbound14d property', async () => {
    stubFetch({
      exceptions: {
        failedIntegrations: 0,
        openLowStockAlerts: 0,
        ordersAwaitingApproval: 0,
      },
      inboundOutbound14d: [{ date: '2026-08-01', inbound: 999, outbound: 1 }],
      openOrderValue: '0.00',
      recentMovements: [],
      recentOrders: [],
    });

    const view = render(
      <QueryProvider>
        <OverviewWorkspace session={managerSession} />
      </QueryProvider>,
    );

    expect(await screen.findByText('No movement window yet')).toBeVisible();
    expect(screen.queryByText('+999')).not.toBeInTheDocument();
    view.unmount();
  });

  it('surfaces an analytics failure with a retry that recovers', async () => {
    let analyticsAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/dashboard/overview')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                exceptions: {
                  failedIntegrations: 0,
                  openLowStockAlerts: 0,
                  ordersAwaitingApproval: 0,
                },
                fourteenDayMovements: [],
                openOrderValue: '0.00',
                recentMovements: [],
                recentOrders: [],
              }),
              { headers: { 'Content-Type': 'application/json' }, status: 200 },
            ),
          );
        }
        if (url.includes('/analytics')) {
          analyticsAttempts += 1;
          if (analyticsAttempts === 1) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  code: 'INTERNAL_ERROR',
                  title: 'Internal error',
                  detail: 'Analytics is unavailable.',
                }),
                {
                  headers: { 'Content-Type': 'application/json' },
                  status: 500,
                },
              ),
            );
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({
                averageFulfilledOrderValue: '46.25',
                fulfilledOrderCount: 2,
                fulfilledOrderValue: '92.50',
                lowStockSkuCount: 1,
                ordersByStatus: [{ count: 2, status: 'DRAFT' }],
                topFulfilledProducts: [
                  { name: 'Craggy Oat Milk', sku: 'OAT-12', unitsFulfilled: 5 },
                ],
              }),
              { headers: { 'Content-Type': 'application/json' }, status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ items: [], page: 1, pageSize: 25, total: 0 }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 },
          ),
        );
      }),
    );

    const view = render(
      <QueryProvider>
        <OverviewWorkspace session={managerSession} />
      </QueryProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /analytics could not be loaded/i,
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Craggy Oat Milk')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    view.unmount();
  });
});
