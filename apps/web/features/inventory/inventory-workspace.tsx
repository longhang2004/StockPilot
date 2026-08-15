'use client';

import { type Role } from '@stockpilot/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
  SearchFilterBar,
  Skeleton,
  StatCard,
  StatusBadge,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { ALERTS_RESOURCE, BALANCES_RESOURCE } from './api';
import { AdjustmentDrawer } from './components/adjustment-drawer';
import { type AlertRecord, type BalanceRecord } from '../shared/types';

export function InventoryWorkspace({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const [alertStatus, setAlertStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const balances = usePage<BalanceRecord>(BALANCES_RESOURCE, {
    page: 1,
    pageSize: 100,
  });
  const alerts = usePage<AlertRecord>(ALERTS_RESOURCE, {
    page: 1,
    pageSize: 100,
    status: alertStatus,
  });
  const filtered = useMemo(
    () =>
      (balances.data?.items ?? []).filter((item) =>
        `${item.product.sku} ${item.product.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [balances.data?.items, search],
  );
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
      {balances.isLoading || alerts.isLoading ? (
        <Skeleton lines={6} />
      ) : balances.isError || alerts.isError ? (
        <ErrorState
          description="Inventory balances or alerts could not be loaded."
          onRetry={() => {
            void balances.refetch();
            void alerts.refetch();
          }}
        />
      ) : (
        <>
          <div className="workspace-grid" aria-label="Inventory summary">
            <StatCard
              hint="Current tenant balances"
              label="SKUs tracked"
              value={balances.data?.total ?? 0}
            />
            <StatCard
              hint="At or below reorder point"
              label="Open alerts"
              tone="danger"
              value={
                (alerts.data?.items ?? []).filter(
                  (alert) => alert.status === 'OPEN',
                ).length
              }
            />
            <StatCard
              hint="Available units across balances"
              label="Available"
              tone="positive"
              value={filtered.reduce(
                (sum, balance) => sum + balance.available,
                0,
              )}
            />
          </div>
          <SearchFilterBar
            onSearch={setSearch}
            placeholder="Search SKU or product"
            search={search}
          >
            <select
              aria-label="Filter alerts"
              onChange={(event) =>
                setAlertStatus(event.target.value as 'OPEN' | 'RESOLVED')
              }
              value={alertStatus}
            >
              <option value="OPEN">Open alerts</option>
              <option value="RESOLVED">Resolved alerts</option>
            </select>
          </SearchFilterBar>
          {filtered.length ? (
            <ResponsiveDataTable
              columns={balanceColumns}
              data={filtered}
              getRowLabel={(record) => record.product.sku}
            />
          ) : (
            <EmptyState
              description="Try a different SKU or receive stock to create a balance."
              title="No inventory matches this search"
            />
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
            {alerts.data?.items.length ? (
              <ResponsiveDataTable
                ariaLabel="Low-stock alerts"
                columns={alertColumns}
                data={alerts.data.items}
                getRowLabel={(record) => record.product.sku}
              />
            ) : (
              <EmptyState
                description="No products are currently at or below their reorder threshold."
                title="No open alerts"
              />
            )}
          </article>
        </>
      )}
      <ToastRegion toasts={toasts} />
      <AdjustmentDrawer
        onClose={() => setAdjustOpen(false)}
        onSaved={() => {
          setAdjustOpen(false);
          void invalidatePageQueries(queryClient, BALANCES_RESOURCE);
          void invalidatePageQueries(queryClient, ALERTS_RESOURCE);
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
