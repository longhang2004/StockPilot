'use client';

import { type InventorySummary, type Role } from '@stockpilot/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import Link from 'next/link';
import { useState } from 'react';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  ResponsiveDataTable,
  SearchFilterBar,
  Skeleton,
  StatCard,
  StatusBadge,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { apiRequest } from '../../lib/api-client';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { ALERTS_RESOURCE, BALANCES_RESOURCE } from './api';
import { AdjustmentDrawer } from './components/adjustment-drawer';
import { type AlertRecord, type BalanceRecord } from '../shared/types';

export function InventoryWorkspace({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);
  const [alertStatus, setAlertStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const balances = usePage<BalanceRecord>(BALANCES_RESOURCE, {
    page,
    pageSize: 25,
    search,
  });
  const alerts = usePage<AlertRecord>(ALERTS_RESOURCE, {
    page: alertPage,
    pageSize: 25,
    status: alertStatus,
  });
  const summary = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => apiRequest<InventorySummary>('/inventory/summary'),
  });
  const canAdjust = role === 'MANAGER' || role === 'OWNER';

  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Separate on-hand, reserved, and available stock before promising an order."
        title="Inventory"
        action={
          canAdjust ? (
            <button
              className="button button-primary"
              onClick={() => setAdjustOpen(true)}
              type="button"
            >
              <Plus size={16} /> Adjust stock
            </button>
          ) : undefined
        }
      />
      {summary.isLoading ? (
        <Skeleton lines={3} />
      ) : summary.isError ? (
        <ErrorState
          description="Inventory summary could not be loaded."
          onRetry={() => void summary.refetch()}
        />
      ) : (
        <div className="workspace-grid" aria-label="Inventory summary">
          <StatCard
            hint="All workspace inventory balances"
            label="SKUs tracked"
            value={summary.data?.trackedSkus ?? 0}
          />
          <StatCard
            hint="All open alerts in this workspace"
            label="Open alerts"
            tone="danger"
            value={summary.data?.openAlerts ?? 0}
          />
          <StatCard
            hint="Units across all workspace balances"
            label="Available"
            tone="positive"
            value={summary.data?.availableUnits ?? 0}
          />
        </div>
      )}
      <SearchFilterBar
        onSearch={(value) => {
          setPage(1);
          setSearch(value);
        }}
        placeholder="Search SKU or product"
        search={search}
      >
        <select
          aria-label="Filter alerts"
          onChange={(event) => {
            setAlertPage(1);
            setAlertStatus(event.target.value as 'OPEN' | 'RESOLVED');
          }}
          value={alertStatus}
        >
          <option value="OPEN">Open alerts</option>
          <option value="RESOLVED">Resolved alerts</option>
        </select>
      </SearchFilterBar>
      {balances.isLoading ? (
        <Skeleton lines={5} />
      ) : balances.isError ? (
        <ErrorState
          description="Inventory balances could not be loaded."
          onRetry={() => void balances.refetch()}
        />
      ) : (
        <>
          <p className="muted-note">
            {balances.data?.total ?? 0} balances match this view
          </p>
          {balances.data?.items.length ? (
            <ResponsiveDataTable
              columns={balanceColumns}
              data={balances.data.items}
              getRowLabel={(record) => record.product.sku}
            />
          ) : (
            <EmptyState
              description="Try a different SKU or receive stock to create a balance."
              title="No inventory matches this search"
            />
          )}
          <Pagination
            onPageChange={setPage}
            page={page}
            totalPages={balances.data?.totalPages ?? 0}
          />
        </>
      )}
      <article className="work-panel alert-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Exception queue</p>
            <h2>
              {alertStatus === 'OPEN'
                ? 'Open low-stock alerts'
                : 'Resolved alert history'}
            </h2>
          </div>
          <Link className="button button-secondary" href="/app/receipts">
            Receive stock
          </Link>
        </div>
        {alerts.isLoading ? (
          <Skeleton lines={4} />
        ) : alerts.isError ? (
          <ErrorState
            description="Low-stock alerts could not be loaded."
            onRetry={() => void alerts.refetch()}
          />
        ) : alerts.data?.items.length ? (
          <ResponsiveDataTable
            ariaLabel="Low-stock alerts"
            columns={alertColumns}
            data={alerts.data.items}
            getRowLabel={(record) => record.product.sku}
          />
        ) : (
          <EmptyState
            description="No products are currently at or below their reorder threshold."
            title={
              alertStatus === 'OPEN' ? 'No open alerts' : 'No resolved alerts'
            }
          />
        )}
        <Pagination
          onPageChange={setAlertPage}
          page={alertPage}
          totalPages={alerts.data?.totalPages ?? 0}
        />
      </article>
      <ToastRegion toasts={toasts} />
      <AdjustmentDrawer
        onClose={() => setAdjustOpen(false)}
        onSaved={() => {
          setAdjustOpen(false);
          void invalidatePageQueries(queryClient, BALANCES_RESOURCE);
          void invalidatePageQueries(queryClient, ALERTS_RESOURCE);
          void queryClient.invalidateQueries({
            queryKey: ['inventory-summary'],
          });
          push('Stock adjustment applied to the ledger.', 'success');
        }}
        open={adjustOpen}
        push={push}
      />
    </section>
  );
}

const balanceColumns: TableColumn<BalanceRecord>[] = [
  {
    key: 'sku',
    label: 'SKU',
    render: (record) => <span className="mono">{record.product.sku}</span>,
  },
  {
    key: 'product',
    label: 'Product',
    render: (record) => <strong>{record.product.name}</strong>,
  },
  {
    key: 'onHand',
    label: 'On hand',
    align: 'right',
    render: (record) => <span className="mono">{record.onHand}</span>,
  },
  {
    key: 'reserved',
    label: 'Reserved',
    align: 'right',
    render: (record) => <span className="mono">{record.reserved}</span>,
  },
  {
    key: 'available',
    label: 'Available',
    align: 'right',
    render: (record) => (
      <span className="mono">
        <strong>{record.available}</strong>
      </span>
    ),
  },
  {
    key: 'updatedAt',
    label: 'Last movement',
    align: 'right',
    render: (record) => formatDate(record.updatedAt),
  },
];

const alertColumns: TableColumn<AlertRecord>[] = [
  {
    key: 'sku',
    label: 'SKU',
    render: (record) => <span className="mono">{record.product.sku}</span>,
  },
  {
    key: 'product',
    label: 'Product',
    render: (record) => <strong>{record.product.name}</strong>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (record) => <StatusBadge value={record.status} />,
  },
  {
    key: 'available',
    label: 'Available',
    align: 'right',
    render: (record) => <span className="mono">{record.availableAtOpen}</span>,
  },
  {
    key: 'reorderPoint',
    label: 'Reorder threshold',
    align: 'right',
    render: (record) => <span className="mono">{record.reorderPoint}</span>,
  },
  {
    key: 'openedAt',
    label: 'Triggered',
    align: 'right',
    render: (record) => formatDateTime(record.openedAt),
  },
];
