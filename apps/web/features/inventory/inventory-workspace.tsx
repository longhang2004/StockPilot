'use client';

import {
  type InventoryProductTrace,
  type InventorySummary,
  type Role,
  type StockMovementItem,
} from '@stockpilot/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import Link from 'next/link';
import { useState } from 'react';

import {
  EmptyState,
  Drawer,
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
import { useWorkspaceLocation } from '../shared/use-workspace-location';
import { fetchProductTrace } from './api';

export function InventoryWorkspace({ role }: { role: Role }) {
  const { params, update } = useWorkspaceLocation();
  const productId = params.get('product');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);
  const [alertStatus, setAlertStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reservationsPage, setReservationsPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
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
  const trace = useQuery({
    queryKey: ['inventory-trace', productId, reservationsPage, movementsPage],
    queryFn: () =>
      fetchProductTrace(productId!, { reservationsPage, movementsPage }),
    enabled: Boolean(productId),
  });

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
      {productId ? (
        <Drawer
          key={productId}
          open
          title="Stock trace"
          description={trace.data?.product.sku}
          size="wide"
          onClose={() => update({ product: null }, 'push')}
        >
          <ProductTraceView
            error={trace.isError}
            loading={trace.isLoading}
            onClose={() => update({ product: null }, 'push')}
            onMovementPage={setMovementsPage}
            onReservationPage={setReservationsPage}
            refetch={() => void trace.refetch()}
            value={trace.data}
          />
        </Drawer>
      ) : null}
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

function ProductTraceView({
  error,
  loading,
  onClose,
  onMovementPage,
  onReservationPage,
  refetch,
  value,
}: {
  error: boolean;
  loading: boolean;
  onClose: () => void;
  onMovementPage: (page: number) => void;
  onReservationPage: (page: number) => void;
  refetch: () => void;
  value: InventoryProductTrace | undefined;
}) {
  if (loading)
    return (
      <article className="work-panel">
        <Skeleton lines={5} />
      </article>
    );
  if (error)
    return (
      <article className="work-panel">
        <ErrorState
          description="The product trace could not be loaded."
          onRetry={refetch}
        />
      </article>
    );
  if (!value) return null;
  const movements = value.movements;
  return (
    <article
      className="work-panel detail-stack"
      aria-label={`Trace for ${value.product.sku}`}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SKU trace</p>
          <h2>
            {value.product.name}{' '}
            <span className="mono">{value.product.sku}</span>
          </h2>
        </div>
        <button
          className="button button-secondary"
          onClick={onClose}
          type="button"
        >
          Close trace
        </button>
      </div>
      <div className="workspace-grid" aria-label="Current stock balance">
        <StatCard
          hint="Physical units in the warehouse"
          label="On hand"
          value={value.balance?.onHand ?? 0}
        />
        <StatCard
          hint="Confirmed order lines"
          label="Reserved"
          value={value.balance?.reserved ?? 0}
        />
        <StatCard
          hint="Available to promise"
          label="Available"
          tone="positive"
          value={value.balance?.available ?? 0}
        />
      </div>
      <section aria-labelledby="trace-reservations">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Current commitments</p>
            <h3 id="trace-reservations">Confirmed reservations</h3>
          </div>
        </div>
        {value.reservations.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="numeric">Qty</th>
                  <th>Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {value.reservations.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        className="mono"
                        href={`/app/orders?order=${encodeURIComponent(item.orderId)}`}
                      >
                        {item.orderNumber}
                      </Link>
                    </td>
                    <td>{item.customerCompanyName}</td>
                    <td className="numeric mono">{item.quantity}</td>
                    <td>
                      {item.confirmedAt
                        ? formatDateTime(item.confirmedAt)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description="There are no confirmed order lines reserving this SKU."
            title="No current reservations"
          />
        )}
        <Pagination
          onPageChange={onReservationPage}
          page={value.reservations.page}
          totalPages={value.reservations.totalPages}
        />
      </section>
      <section aria-labelledby="trace-movements">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Append-only ledger</p>
            <h3 id="trace-movements">Source movements</h3>
          </div>
        </div>
        {movements.items.length ? (
          <ResponsiveDataTable
            ariaLabel="SKU source movements"
            columns={movementColumns}
            data={movements.items}
            getRowLabel={(item) => item.id}
          />
        ) : (
          <EmptyState
            description="No ledger movements exist for this SKU."
            title="No movements"
          />
        )}
        <Pagination
          onPageChange={onMovementPage}
          page={movements.page}
          totalPages={movements.totalPages}
        />
      </section>
    </article>
  );
}

const movementColumns: TableColumn<StockMovementItem>[] = [
  {
    key: 'type',
    label: 'Movement',
    render: (item) => <StatusBadge value={item.type} />,
  },
  {
    key: 'createdAt',
    label: 'When',
    render: (item) => formatDateTime(item.createdAt),
  },
  {
    key: 'quantityDelta',
    label: 'Change',
    align: 'right',
    render: (item) => (
      <span className="mono">
        {item.quantityDelta > 0 ? '+' : ''}
        {item.quantityDelta}
      </span>
    ),
  },
  {
    key: 'onHandAfter',
    label: 'On hand after',
    align: 'right',
    render: (item) => <span className="mono">{item.onHandAfter}</span>,
  },
  {
    key: 'referenceId',
    label: 'Source',
    render: (item) =>
      item.referenceType === 'SALES_ORDER' ? (
        <Link
          className="mono"
          href={`/app/orders?order=${encodeURIComponent(item.referenceId)}`}
        >
          Sales order
        </Link>
      ) : item.referenceType === 'GOODS_RECEIPT' ? (
        <Link
          className="mono"
          href={`/app/receipts?receipt=${encodeURIComponent(item.referenceId)}`}
        >
          Goods receipt
        </Link>
      ) : (
        <span className="mono" title={item.referenceType}>
          {item.referenceType || 'Unlinked'} · {item.referenceId.slice(0, 8)}
        </span>
      ),
  },
];

const balanceColumns: TableColumn<BalanceRecord>[] = [
  {
    key: 'sku',
    label: 'SKU',
    render: (record) => (
      <Link
        className="mono"
        href={`/app/inventory?product=${encodeURIComponent(record.productId)}`}
      >
        {record.product.sku}
      </Link>
    ),
  },
  {
    key: 'product',
    label: 'Product',
    render: (record) => (
      <Link
        href={`/app/inventory?product=${encodeURIComponent(record.productId)}`}
      >
        {record.product.name}
      </Link>
    ),
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
