'use client';

import { ArrowRight } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
  Skeleton,
  StatCard,
  StatusBadge,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { apiRequest } from '../../lib/api-client';
import { formatDate, formatDateTime } from '../../lib/formatters';
import {
  type OverviewRecentOrder,
  type OverviewResponse,
  type WorkspaceSessionView,
} from '../shared/types';
import { AnalyticsPanels } from './analytics-panels';
import { DemoQuickGuide } from './demo-quick-guide';
import { MovementChart } from './movement-chart';

export function OverviewWorkspace({
  session,
}: {
  session: WorkspaceSessionView;
}) {
  const overview = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => apiRequest<OverviewResponse>('/dashboard/overview'),
  });
  if (overview.isLoading) {
    return (
      <section className="workspace-section-page">
        <PageHeader
          title="Operations overview"
          description={`One clear queue for ${session.membership.organization.name}.`}
        />
        <Skeleton lines={6} />
      </section>
    );
  }
  if (overview.isError) {
    return (
      <section className="workspace-section-page">
        <PageHeader
          title="Operations overview"
          description={`One clear queue for ${session.membership.organization.name}.`}
        />
        <ErrorState
          description="The operational overview is temporarily unavailable."
          onRetry={() => void overview.refetch()}
        />
      </section>
    );
  }
  const data = {
    exceptions: {
      failedIntegrations: overview.data?.exceptions?.failedIntegrations ?? 0,
      openLowStockAlerts: overview.data?.exceptions?.openLowStockAlerts ?? 0,
      ordersAwaitingApproval:
        overview.data?.exceptions?.ordersAwaitingApproval ?? 0,
    },
    openOrderValue: overview.data?.openOrderValue ?? '0.00',
    recentMovements: overview.data?.recentMovements ?? [],
    recentOrders: overview.data?.recentOrders ?? [],
    fourteenDayMovements: overview.data?.fourteenDayMovements ?? [],
  };
  const summaryRows = data.fourteenDayMovements.map((row) => ({
    date: row.day,
    inbound: row.inbound,
    outbound: row.outbound,
  }));
  return (
    <section
      className="workspace-section-page"
      aria-labelledby="overview-title"
    >
      <PageHeader
        description={`One clear queue for ${session.membership.organization.name}. Keep exceptions moving and stock promises honest.`}
        title="Operations overview"
        action={
          <>
            <span
              className={`plan-badge plan-badge-${(overview.data?.plan ?? 'PRO').toLowerCase()}`}
            >
              {overview.data?.plan ?? 'PRO'}
            </span>
            <Link className="button button-primary" href="/app/orders?new=1">
              Create draft order <ArrowRight size={17} />
            </Link>
          </>
        }
      />
      <div className="workspace-grid" aria-label="Operational summary">
        <StatCard
          hint="Draft orders need a Manager"
          label="Awaiting approval"
          tone="attention"
          value={data.exceptions.ordersAwaitingApproval}
        />
        <StatCard
          hint="Available stock at or below threshold"
          label="Low-stock alerts"
          tone="danger"
          value={data.exceptions.openLowStockAlerts}
        />
        <StatCard
          hint="Draft and confirmed orders"
          label="Open order value"
          tone="positive"
          value={`$${data.openOrderValue}`}
        />
        <StatCard
          hint="Delivery retries need review"
          label="Integration failures"
          tone="danger"
          value={data.exceptions.failedIntegrations}
        />
      </div>
      {session.membership.organization.isDemo ? <DemoQuickGuide /> : null}
      <div className="workspace-panels">
        <article className="work-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Needs attention</p>
              <h2>Priority work queue</h2>
            </div>
            <Link className="button button-secondary" href="/app/orders">
              View orders
            </Link>
          </div>
          <div className="work-row">
            <StatusBadge value="OPEN" />
            <span>
              <strong>
                {data.exceptions.openLowStockAlerts} products below reorder
                point
              </strong>
              <small>Receive stock to resolve an alert</small>
            </span>
            <Link href="/app/receipts">Receive stock</Link>
          </div>
          <div className="work-row">
            <StatusBadge value="DRAFT" />
            <span>
              <strong>
                {data.exceptions.ordersAwaitingApproval} draft orders
              </strong>
              <small>Review before reservation</small>
            </span>
            <Link href="/app/orders?status=DRAFT">Review orders</Link>
          </div>
          <div className="work-row">
            <StatusBadge value="FAILED" />
            <span>
              <strong>
                {data.exceptions.failedIntegrations} failed deliveries
              </strong>
              <small>Retry safely after inspecting the payload</small>
            </span>
            <Link href="/app/integrations">Inspect events</Link>
          </div>
        </article>
        <article className="work-panel recent-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Stock movements</h2>
            </div>
            <Link className="button button-secondary" href="/app/inventory">
              Inventory
            </Link>
          </div>
          {data.recentMovements.length ? (
            data.recentMovements.map((movement) => (
              <div className="movement-row" key={movement.id}>
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
                  <strong>{movement.product?.name ?? 'Unknown product'}</strong>
                  <small>
                    {movement.type} · {formatDateTime(movement.createdAt)}
                  </small>
                </span>
              </div>
            ))
          ) : (
            <EmptyState
              description="New receipt and sale movements will appear here."
              title="No movements yet"
            />
          )}
        </article>
      </div>
      <article className="work-panel overview-orders-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Order pulse</p>
            <h2>Recent orders</h2>
          </div>
          <Link className="button button-secondary" href="/app/orders">
            Open queue
          </Link>
        </div>
        {data.recentOrders.length ? (
          <ResponsiveDataTable
            ariaLabel="Recent orders"
            columns={recentOrderColumns}
            data={data.recentOrders}
            getRowLabel={(record) => record.orderNumber}
          />
        ) : (
          <EmptyState
            description="Start a draft order to see customer demand here."
            title="No recent orders"
          />
        )}
      </article>
      <MovementChart rows={summaryRows} />
      <AnalyticsPanels />
    </section>
  );
}

const recentOrderColumns: TableColumn<OverviewRecentOrder>[] = [
  {
    key: 'orderNumber',
    label: 'Order',
    render: (record) => <span className="mono">{record.orderNumber}</span>,
  },
  { key: 'customerCompanyName', label: 'Customer' },
  {
    key: 'status',
    label: 'Status',
    render: (record) => <StatusBadge value={record.status} />,
  },
  {
    key: 'subtotal',
    label: 'Value',
    render: (record) => <span className="mono">${record.subtotal}</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (record) => formatDate(record.createdAt),
  },
];
