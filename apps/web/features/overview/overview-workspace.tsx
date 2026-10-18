'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
  Skeleton,
  StatusBadge,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { formatDate, formatDateTime } from '../../lib/formatters';
import {
  type OverviewRecentOrder,
  type WorkspaceSessionView,
} from '../shared/types';
import { fetchOverview, overviewKeys } from './api';
import { AnalyticsPanels } from './analytics-panels';
import { DemoQuickGuide } from './demo-quick-guide';
import { ExceptionsWorklist } from './exceptions-worklist';
import { MovementChart } from './movement-chart';

export function OverviewWorkspace({
  session,
}: {
  session: WorkspaceSessionView;
}) {
  const overview = useQuery({
    queryKey: overviewKeys.overview,
    queryFn: fetchOverview,
    refetchOnMount: 'always',
    retry: false,
  });
  const data = overview.data;
  const summaryRows = data?.fourteenDayMovements?.map((row) => ({
    date: row.day,
    inbound: row.inbound,
    outbound: row.outbound,
  }));

  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Track draft orders, low-stock alerts, and failed deliveries from one queue."
        title="Operations overview"
        action={
          <Link className="button button-primary" href="/app/orders?new=1">
            Create draft order
          </Link>
        }
      />

      <ExceptionsWorklist role={session.membership.role} />

      {session.membership.organization.isDemo ? (
        <DemoQuickGuide role={session.membership.role} />
      ) : null}

      <section
        className="overview-support"
        aria-labelledby="overview-support-title"
      >
        <header className="overview-support-heading">
          <div>
            <h2 id="overview-support-title">Recent activity and performance</h2>
            <p>Supporting context for the active worklist.</p>
          </div>
          {data && !overview.isRefetching && !overview.isError ? (
            <p className="overview-open-value">
              <span>Open order value</span>
              <strong className="mono">${data.openOrderValue}</strong>
            </p>
          ) : null}
        </header>

        {overview.isLoading || overview.isRefetching ? (
          <Skeleton lines={5} />
        ) : overview.isError ? (
          <ErrorState
            description="Recent activity and its summary could not be loaded. The actionable worklist remains available."
            onRetry={() => void overview.refetch()}
          />
        ) : data ? (
          <>
            <div className="workspace-panels overview-support-panels">
              <article className="work-panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent stock movements</h3>
                  </div>
                  <Link
                    className="button button-secondary"
                    href="/app/inventory"
                  >
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
                        <strong>
                          {movement.product?.name ?? 'Unknown product'}
                        </strong>
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

              <article className="work-panel overview-orders-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent orders</h3>
                  </div>
                  <Link className="button button-secondary" href="/app/orders">
                    Open orders
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
                    description="Create a draft to see recent customer orders here."
                    title="No recent orders"
                  />
                )}
              </article>
            </div>
            <MovementChart rows={summaryRows ?? []} />
          </>
        ) : null}

        <AnalyticsPanels />
      </section>
    </section>
  );
}

const recentOrderColumns: TableColumn<OverviewRecentOrder>[] = [
  {
    key: 'orderNumber',
    label: 'Order',
    render: (record) => (
      <Link href={`/app/orders?order=${encodeURIComponent(record.id)}`}>
        {record.orderNumber}
      </Link>
    ),
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
    align: 'right',
    render: (record) => <span className="mono">${record.subtotal}</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    align: 'right',
    render: (record) => formatDate(record.createdAt),
  },
];
