import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../lib/query-provider';
import { ExceptionsWorklist } from './exceptions-worklist';
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

describe('OverviewWorkspace actionable worklist', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('links seeded draft, alert, and failed delivery identities to their records', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/analytics')
          ? {
              averageFulfilledOrderValue: '0.00',
              fulfilledOrderCount: 0,
              fulfilledOrderValue: '0.00',
              lowStockSkuCount: 0,
              ordersByStatus: [],
              topFulfilledProducts: [],
            }
          : url.includes('/dashboard/overview')
            ? {
                exceptions: {
                  failedIntegrations: 1,
                  openLowStockAlerts: 1,
                  ordersAwaitingApproval: 1,
                },
                fourteenDayMovements: [],
                openOrderValue: '0.00',
                recentMovements: [],
                recentOrders: [],
              }
            : url.includes('/orders?')
              ? {
                  items: [
                    {
                      id: 'draft-1',
                      orderNumber: 'SO-2042',
                      status: 'DRAFT',
                      customerCompanyName: 'Northwind Supply',
                      createdAt: '2026-10-18T08:30:00.000Z',
                    },
                  ],
                  page: 1,
                  pageSize: 5,
                  total: 1,
                  totalPages: 1,
                }
              : url.includes('/alerts?')
                ? {
                    items: [
                      {
                        id: 'alert-1',
                        productId: 'product-9',
                        status: 'OPEN',
                        availableAtOpen: 1,
                        reorderPoint: 8,
                        openedAt: '2026-10-18T07:00:00.000Z',
                        product: { name: 'Oat Milk', sku: 'OAT-12' },
                      },
                    ],
                    page: 1,
                    pageSize: 5,
                    total: 1,
                    totalPages: 1,
                  }
                : url.includes('/integration-deliveries?')
                  ? {
                      items: [
                        {
                          id: 'delivery-5',
                          externalDeliveryId: 'ext-55',
                          eventType: 'stock.adjusted',
                          status: 'FAILED',
                          attempts: 2,
                          lastError: 'Remote endpoint unavailable',
                          payload: {},
                          createdAt: '2026-10-18T06:15:00.000Z',
                          processedAt: null,
                        },
                      ],
                      page: 1,
                      pageSize: 5,
                      total: 1,
                      totalPages: 1,
                    }
                  : {
                      exceptions: {
                        failedIntegrations: 1,
                        openLowStockAlerts: 1,
                        ordersAwaitingApproval: 1,
                      },
                      fourteenDayMovements: [],
                      openOrderValue: '0.00',
                      recentMovements: [],
                      recentOrders: [],
                    };

        return Promise.resolve(
          new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        );
      }),
    );

    render(
      <QueryProvider>
        <OverviewWorkspace session={managerSession} />
      </QueryProvider>,
    );

    expect(
      await screen.findByRole('link', { name: 'SO-2042' }),
    ).toHaveAttribute('href', '/app/orders?status=DRAFT&order=draft-1');
    expect(screen.getByRole('link', { name: 'Review draft' })).toHaveAttribute(
      'href',
      '/app/orders?status=DRAFT&order=draft-1',
    );
    expect(screen.getByRole('link', { name: 'Oat Milk' })).toHaveAttribute(
      'href',
      '/app/inventory?product=product-9',
    );
    expect(
      screen.getByText(/Available when opened: 1 · reorder point: 8/),
    ).toBeVisible();
    expect(screen.queryByText(/available now/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Delivery ext-55' }),
    ).toHaveAttribute(
      'href',
      '/app/integrations?status=FAILED&delivery=delivery-5',
    );
    expect(screen.getByText(/Remote endpoint unavailable/)).toBeVisible();
  });

  it('shows a staff-appropriate draft action without requesting manager-only deliveries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/analytics')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                averageFulfilledOrderValue: '0.00',
                fulfilledOrderCount: 0,
                fulfilledOrderValue: '0.00',
                lowStockSkuCount: 0,
                ordersByStatus: [],
                topFulfilledProducts: [],
              }),
              { headers: { 'Content-Type': 'application/json' }, status: 200 },
            ),
          );
        }
        if (url.includes('/dashboard/overview')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                exceptions: {
                  failedIntegrations: 0,
                  openLowStockAlerts: 0,
                  ordersAwaitingApproval: 1,
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
        if (url.includes('/orders?')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'draft-staff',
                    orderNumber: 'SO-STAFF',
                    status: 'DRAFT',
                    customerCompanyName: 'Wholesale Co',
                    createdAt: '2026-10-18T08:30:00.000Z',
                  },
                ],
                page: 1,
                pageSize: 5,
                total: 1,
                totalPages: 1,
              }),
              { headers: { 'Content-Type': 'application/json' }, status: 200 },
            ),
          );
        }
        if (url.includes('/alerts?')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: 'staff-alert',
                    productId: 'staff-product',
                    status: 'OPEN',
                    availableAtOpen: 1,
                    reorderPoint: 8,
                    openedAt: '2026-10-18T07:00:00.000Z',
                    product: { name: 'Staff item', sku: 'STF-8' },
                  },
                ],
                page: 1,
                pageSize: 5,
                total: 1,
                totalPages: 1,
              }),
              { headers: { 'Content-Type': 'application/json' }, status: 200 },
            ),
          );
        }
        if (url.includes('/integration-deliveries?')) {
          return Promise.resolve(
            new Response('unexpected request', { status: 403 }),
          );
        }
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
      }),
    );

    render(
      <QueryProvider>
        <OverviewWorkspace
          session={{
            ...managerSession,
            membership: { ...managerSession.membership, role: 'STAFF' },
          }}
        />
      </QueryProvider>,
    );

    expect(
      await screen.findByRole('link', { name: 'Edit draft' }),
    ).toHaveAttribute('href', '/app/orders?status=DRAFT&order=draft-staff');
    expect(
      screen.queryByRole('link', { name: 'Review draft' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        /Delivery review is available to Managers and Owners/,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Inspect delivery' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View stock' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Receive stock' }),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) =>
          String(input).includes('/integration-deliveries'),
        ),
    ).toBe(false);
  });

  it('reports a manager source failure without rendering a zero count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/alerts?')) {
          return Promise.resolve(new Response('unavailable', { status: 503 }));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [],
              page: 1,
              pageSize: 5,
              total: 0,
              totalPages: 0,
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 },
          ),
        );
      }),
    );

    render(
      <QueryProvider>
        <ExceptionsWorklist role="MANAGER" />
      </QueryProvider>,
    );

    expect(
      await screen.findByText(/Low-stock alerts could not be loaded/i),
    ).toBeVisible();
    expect(screen.queryByText('0 open alerts')).not.toBeInTheDocument();
  });
});
