'use client';

import {
  CustomerInputSchema,
  InventoryAdjustmentInputSchema,
  ProductInputSchema,
  ReceiptInputSchema,
  SalesOrderInputSchema,
  SupplierInputSchema,
  type Role,
} from '@stockpilot/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  DownloadSimple,
  Plus,
  UploadSimple,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  apiRequest,
  newIdempotencyKey,
  type PageResponse,
  type SessionResponse,
} from '../../lib/api-client';
import {
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  PageHeader,
  Pagination,
  ResponsiveDataTable,
  SearchFilterBar,
  Skeleton,
  StatCard,
  StatusBadge,
  ToastRegion,
  UnsavedChangesGuard,
  type TableColumn,
  type ToastMessage,
} from '../ui/operations-ui';

type SessionView = Pick<SessionResponse, 'membership' | 'user'>;

interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  salePrice: string;
  reorderPoint: number;
  isActive: boolean;
}

interface PartnerRecord {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

interface BalanceRecord {
  id: string;
  productId: string;
  product: { sku: string; name: string };
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: string;
}

interface AlertRecord {
  id: string;
  productId: string;
  product: { sku: string; name: string };
  status: 'OPEN' | 'RESOLVED';
  availableAtOpen: number;
  reorderPoint: number;
  openedAt: string;
  resolvedAt: string | null;
}

interface MovementRecord {
  id: string;
  type: string;
  quantityDelta: number;
  createdAt: string;
  product?: { sku: string; name: string };
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  customerCompanyName: string;
  status: 'DRAFT' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED';
  subtotal: string;
  createdAt: string;
}

interface OrderDetail extends OrderRecord {
  note: string | null;
  lines: Array<{
    id: string;
    skuSnapshot: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  transitions: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
  }>;
}

interface IntegrationRecord {
  id: string;
  externalDeliveryId: string;
  eventType: string;
  status: 'RECEIVED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  attempts: number;
  lastError: string | null;
  payload: unknown;
  createdAt: string;
  processedAt: string | null;
}

interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor?: { displayName: string } | null;
}

interface OverviewResponse {
  exceptions: {
    ordersAwaitingApproval: number;
    openLowStockAlerts: number;
    failedIntegrations: number;
  };
  openOrderValue: string;
  recentOrders: OrderRecord[];
  recentMovements: MovementRecord[];
  inboundOutbound14d?: Array<{
    date: string;
    inbound: number;
    outbound: number;
  }>;
  fourteenDayMovements?: Array<{
    day: string;
    inbound: number;
    outbound: number;
  }>;
}

function usePage<T>(path: string) {
  return useQuery({
    queryKey: ['page', path],
    queryFn: () => apiRequest<PageResponse<T>>(path),
  });
}

function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  function push(message: string, tone: ToastMessage['tone'] = 'info') {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4_000,
    );
  }
  return { push, toasts };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

function closeFormSafely(dirty: boolean, onClose: () => void): () => void {
  return () => {
    if (
      dirty &&
      !window.confirm('Discard your unsaved changes and close this form?')
    ) {
      return;
    }
    onClose();
  };
}

export function OverviewWorkspace({ session }: { session: SessionView }) {
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
    inboundOutbound14d: overview.data?.inboundOutbound14d ?? [],
    openOrderValue: overview.data?.openOrderValue ?? '0.00',
    recentMovements: overview.data?.recentMovements ?? [],
    recentOrders: overview.data?.recentOrders ?? [],
    fourteenDayMovements: overview.data?.fourteenDayMovements ?? [],
  };
  const summaryRows =
    data.inboundOutbound14d ??
    data.fourteenDayMovements?.map((row) => ({
      date: row.day,
      inbound: row.inbound,
      outbound: row.outbound,
    })) ??
    [];
  return (
    <section
      className="workspace-section-page"
      aria-labelledby="overview-title"
    >
      <PageHeader
        description={`One clear queue for ${session.membership.organization.name}. Keep exceptions moving and stock promises honest.`}
        title="Operations overview"
        action={
          <Link className="button button-primary" href="/app/orders?new=1">
            Create draft order <ArrowRight size={17} />
          </Link>
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
            columns={orderColumns}
            data={data.recentOrders}
          />
        ) : (
          <EmptyState
            description="Start a draft order to see customer demand here."
            title="No recent orders"
          />
        )}
      </article>
      <InboundOutboundSummary rows={summaryRows} />
    </section>
  );
}

function InboundOutboundSummary({
  rows,
}: {
  rows: Array<{ date: string; inbound: number; outbound: number }>;
}) {
  return (
    <article className="work-panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Last 14 days</p>
          <h2>Inbound and outbound units</h2>
        </div>
        <span className="muted-note">Accessible table summary</span>
      </div>
      {rows.length ? (
        <div className="responsive-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Inbound</th>
                <th scope="col">Outbound</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{formatDate(row.date)}</td>
                  <td className="mono">+{row.inbound}</td>
                  <td className="mono">−{row.outbound}</td>
                  <td className="mono">{row.inbound - row.outbound}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          description="Movements will create the 14-day summary automatically."
          title="No movement window yet"
        />
      )}
    </article>
  );
}

export function OrdersWorkspace({ role }: { role: Role }) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'CANCELLED' | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
    const requestedStatus = searchParams.get('status');
    if (
      requestedStatus === 'DRAFT' ||
      requestedStatus === 'CONFIRMED' ||
      requestedStatus === 'FULFILLED' ||
      requestedStatus === 'CANCELLED'
    ) {
      setStatus(requestedStatus);
    }
  }, [searchParams]);
  const list = usePage<OrderRecord>(
    `/orders?page=${page}&pageSize=25&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ''}`,
  );
  const detail = useQuery({
    queryKey: ['order', selectedId],
    queryFn: () => apiRequest<OrderDetail>(`/orders/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const transition = useMutation({
    mutationFn: async (to: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED') =>
      apiRequest<OrderDetail>(`/orders/${selectedId}/${to.toLowerCase()}`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(`order-${to.toLowerCase()}`),
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Order transition failed.',
        'error',
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['page', '/orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order', selectedId] });
      setConfirmAction(null);
      push('Order status updated.', 'success');
    },
  });
  const canManage = role === 'MANAGER' || role === 'OWNER';
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Keep customer demand, reservations, and fulfillment in one auditable queue."
        title="Sales orders"
        action={
          <button
            className="button button-primary"
            onClick={() => setFormOpen(true)}
            type="button"
          >
            <Plus size={17} /> New draft
          </button>
        }
      />
      <SearchFilterBar
        onSearch={(value) => {
          setPage(1);
          setSearch(value);
        }}
        placeholder="Search order number or customer"
        search={search}
      >
        <select
          aria-label="Filter orders by status"
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          value={status}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </SearchFilterBar>
      {list.isLoading ? (
        <Skeleton lines={5} />
      ) : list.isError ? (
        <ErrorState
          description="Orders could not be loaded."
          onRetry={() => void list.refetch()}
        />
      ) : list.data?.items.length ? (
        <>
          <ResponsiveDataTable
            columns={orderColumns}
            data={list.data.items}
            getRowLabel={(record) => record.orderNumber}
            onRowClick={(record) => setSelectedId(record.id)}
          />
          <Pagination
            onPageChange={setPage}
            page={list.data.page}
            totalPages={list.data.totalPages}
          />
        </>
      ) : (
        <EmptyState
          description="Create a draft order when a customer is ready to buy."
          title="No orders match this view"
          action={
            <button
              className="button button-primary"
              onClick={() => setFormOpen(true)}
              type="button"
            >
              Create draft
            </button>
          }
        />
      )}
      <ToastRegion toasts={toasts} />
      <OrderFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          void queryClient.invalidateQueries({ queryKey: ['page', '/orders'] });
          push('Draft order created.', 'success');
        }}
        push={push}
      />
      <Drawer
        description={
          detail.data
            ? `${detail.data.customerCompanyName} · ${formatDateTime(detail.data.createdAt)}`
            : 'Loading order detail'
        }
        onClose={() => setSelectedId(null)}
        open={Boolean(selectedId)}
        size="wide"
        title={detail.data?.orderNumber ?? 'Order detail'}
      >
        {detail.isLoading ? (
          <Skeleton lines={5} />
        ) : detail.isError || !detail.data ? (
          <ErrorState description="Order detail could not be loaded." />
        ) : (
          <OrderDetailView
            detail={detail.data}
            canManage={canManage}
            onAction={(to) => {
              if (to === 'CANCELLED') setConfirmAction(to);
              else transition.mutate(to);
            }}
            pending={transition.isPending}
            role={role}
          />
        )}
      </Drawer>
      <ConfirmDialog
        confirmLabel="Cancel order"
        destructive
        description="This releases any confirmed reservation and permanently ends the order."
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => transition.mutate('CANCELLED')}
        open={confirmAction === 'CANCELLED'}
        pending={transition.isPending}
        title="Cancel this order?"
      />
    </section>
  );
}

const orderColumns: TableColumn<OrderRecord>[] = [
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

function OrderDetailView({
  detail,
  canManage,
  onAction,
  pending,
  role,
}: {
  detail: OrderDetail;
  canManage: boolean;
  onAction: (to: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED') => void;
  pending: boolean;
  role: Role;
}) {
  return (
    <div className="detail-stack">
      <div className="detail-summary">
        <StatusBadge value={detail.status} />
        <strong className="mono">${detail.subtotal}</strong>
      </div>
      <div className="detail-lines">
        {detail.lines.map((line) => (
          <div className="detail-line" key={line.id}>
            <span>
              <strong>{line.productNameSnapshot}</strong>
              <small className="mono">
                {line.skuSnapshot} · {line.quantity} × ${line.unitPrice}
              </small>
            </span>
            <strong className="mono">${line.lineTotal}</strong>
          </div>
        ))}
      </div>
      {detail.note ? <p className="detail-note">{detail.note}</p> : null}
      <div className="transition-timeline">
        <p className="eyebrow">Transition timeline</p>
        {detail.transitions.map((transition) => (
          <div className="timeline-item" key={transition.id}>
            <span className="timeline-dot" aria-hidden="true" />
            <span>
              <strong>
                {transition.fromStatus ? `${transition.fromStatus} → ` : ''}
                {transition.toStatus}
              </strong>
              <small>{formatDateTime(transition.createdAt)}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="drawer-action-row">
        {detail.status === 'DRAFT' && canManage ? (
          <button
            className="button button-primary"
            disabled={pending}
            onClick={() => onAction('CONFIRMED')}
            type="button"
          >
            Confirm order
          </button>
        ) : null}
        {detail.status === 'CONFIRMED' ? (
          <button
            className="button button-primary"
            disabled={pending}
            onClick={() => onAction('FULFILLED')}
            type="button"
          >
            Fulfill order
          </button>
        ) : null}
        {(detail.status === 'DRAFT' || detail.status === 'CONFIRMED') &&
        canManage ? (
          <button
            className="button button-danger"
            disabled={pending}
            onClick={() => onAction('CANCELLED')}
            type="button"
          >
            Cancel order
          </button>
        ) : null}
        {role === 'STAFF' && detail.status === 'CONFIRMED' ? (
          <p className="muted-note">
            Staff can fulfill confirmed work; Manager approval remains separate.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OrderFormDrawer({
  open,
  onClose,
  onSaved,
  push,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  push: (message: string, tone?: ToastMessage['tone']) => void;
}) {
  const customers = usePage<PartnerRecord>('/customers?page=1&pageSize=100');
  const products = usePage<ProductRecord>('/products?page=1&pageSize=100');
  const form = useForm<z.infer<typeof SalesOrderInputSchema>>({
    resolver: zodResolver(SalesOrderInputSchema) as never,
    defaultValues: {
      customerId: '',
      lines: [{ productId: '', quantity: 1 }],
      note: null,
    },
  });
  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof SalesOrderInputSchema>) =>
      apiRequest<OrderDetail>('/orders', {
        body: JSON.stringify(value),
        method: 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error
          ? error.message
          : 'Could not create the draft order.',
        'error',
      ),
    onSuccess: onSaved,
  });
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="A draft does not reserve stock until a Manager confirms it."
      onClose={close}
      open={open}
      title="New draft order"
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) =>
          void form.handleSubmit((value) => mutation.mutate(value))(event)
        }
      >
        <FormField
          error={form.formState.errors.customerId?.message}
          htmlFor="order-customer"
          label="Customer"
        >
          <select id="order-customer" {...form.register('customerId')}>
            <option value="">Choose customer</option>
            {customers.data?.items.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          error={form.formState.errors.lines?.[0]?.productId?.message}
          htmlFor="order-product"
          label="Product"
        >
          <select id="order-product" {...form.register('lines.0.productId')}>
            <option value="">Choose product</option>
            {products.data?.items
              .filter((product) => product.isActive)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
          </select>
        </FormField>
        <FormField
          error={form.formState.errors.lines?.[0]?.quantity?.message}
          htmlFor="order-quantity"
          label="Quantity"
        >
          <input
            id="order-quantity"
            min="1"
            type="number"
            {...form.register('lines.0.quantity', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          error={form.formState.errors.note?.message}
          htmlFor="order-note"
          label="Note"
        >
          <textarea id="order-note" {...form.register('note')} />
        </FormField>
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function InventoryWorkspace({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const [alertStatus, setAlertStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const balances = usePage<BalanceRecord>(
    '/inventory/balances?page=1&pageSize=100',
  );
  const alerts = usePage<AlertRecord>(
    `/alerts?page=1&pageSize=100&status=${alertStatus}`,
  );
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
              <Plus size={17} /> Adjust stock
            </button>
          ) : undefined
        }
      />
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
      {balances.isLoading || alerts.isLoading ? (
        <Skeleton lines={5} />
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
          <div className="workspace-grid">
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
              alerts.data.items.map((alert) => (
                <div className="work-row" key={alert.id}>
                  <StatusBadge value={alert.status} />
                  <span>
                    <strong>
                      {alert.product.sku} · {alert.product.name}
                    </strong>
                    <small>
                      Available {alert.availableAtOpen} · reorder point{' '}
                      {alert.reorderPoint} · opened{' '}
                      {formatDateTime(alert.openedAt)}
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <EmptyState
                description="The reconciliation worker will keep this queue current."
                title="No alerts in this view"
              />
            )}
          </article>
        </>
      )}
      <ToastRegion toasts={toasts} />
      <AdjustmentDrawer
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onSaved={() => {
          setAdjustOpen(false);
          void queryClient.invalidateQueries({
            queryKey: ['page', '/inventory/balances'],
          });
          void queryClient.invalidateQueries({ queryKey: ['page', '/alerts'] });
          push('Stock adjustment applied.', 'success');
        }}
        push={push}
      />
    </section>
  );
}

const balanceColumns: TableColumn<BalanceRecord>[] = [
  {
    key: 'product',
    label: 'Product',
    render: (record) => (
      <span>
        <strong>{record.product.name}</strong>
        <small className="muted-note mono">{record.product.sku}</small>
      </span>
    ),
  },
  {
    key: 'onHand',
    label: 'On hand',
    render: (record) => <span className="mono">{record.onHand}</span>,
  },
  {
    key: 'reserved',
    label: 'Reserved',
    render: (record) => <span className="mono">{record.reserved}</span>,
  },
  {
    key: 'available',
    label: 'Available',
    render: (record) => (
      <span className="mono">
        <strong>{record.available}</strong>
      </span>
    ),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    render: (record) => formatDate(record.updatedAt),
  },
];

function AdjustmentDrawer({
  open,
  onClose,
  onSaved,
  push,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  push: (message: string, tone?: ToastMessage['tone']) => void;
}) {
  const products = usePage<ProductRecord>('/products?page=1&pageSize=100');
  const form = useForm<z.infer<typeof InventoryAdjustmentInputSchema>>({
    resolver: zodResolver(InventoryAdjustmentInputSchema) as never,
    defaultValues: {
      productId: '',
      quantity: 1,
      reason: '',
      type: 'ADJUSTMENT_IN',
    },
  });
  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof InventoryAdjustmentInputSchema>) =>
      apiRequest('/inventory/adjustments', {
        body: JSON.stringify(value),
        idempotencyKey: newIdempotencyKey('adjustment'),
        method: 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not adjust stock.',
        'error',
      ),
    onSuccess: onSaved,
  });
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="Adjustments create a compensating ledger movement; history is never edited."
      onClose={close}
      open={open}
      title="Adjust inventory"
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) =>
          void form.handleSubmit((value) => mutation.mutate(value))(event)
        }
      >
        <FormField
          error={form.formState.errors.productId?.message}
          htmlFor="adjust-product"
          label="Product"
        >
          <select id="adjust-product" {...form.register('productId')}>
            <option value="">Choose product</option>
            {products.data?.items.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.name}
              </option>
            ))}
          </select>
        </FormField>
        <div className="form-grid">
          <FormField
            error={form.formState.errors.type?.message}
            htmlFor="adjust-type"
            label="Direction"
          >
            <select id="adjust-type" {...form.register('type')}>
              <option value="ADJUSTMENT_IN">Add stock</option>
              <option value="ADJUSTMENT_OUT">Remove stock</option>
            </select>
          </FormField>
          <FormField
            error={form.formState.errors.quantity?.message}
            htmlFor="adjust-quantity"
            label="Quantity"
          >
            <input
              id="adjust-quantity"
              min="1"
              type="number"
              {...form.register('quantity', { valueAsNumber: true })}
            />
          </FormField>
        </div>
        <FormField
          error={form.formState.errors.reason?.message}
          htmlFor="adjust-reason"
          label="Reason"
        >
          <textarea id="adjust-reason" {...form.register('reason')} />
        </FormField>
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? 'Applying…' : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function ReceiptsWorkspace() {
  const [open, setOpen] = useState(false);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const movements = usePage<MovementRecord>(
    '/inventory/movements?page=1&pageSize=100',
  );
  const receipts = (movements.data?.items ?? []).filter(
    (movement) => movement.type === 'RECEIPT',
  );
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Apply a goods receipt atomically and see the resulting ledger movement."
        title="Goods receipts"
        action={
          <button
            className="button button-primary"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Plus size={17} /> Receive stock
          </button>
        }
      />
      {movements.isLoading ? (
        <Skeleton lines={4} />
      ) : movements.isError ? (
        <ErrorState
          description="Receipt history could not be loaded."
          onRetry={() => void movements.refetch()}
        />
      ) : receipts.length ? (
        <ResponsiveDataTable columns={movementColumns} data={receipts} />
      ) : (
        <EmptyState
          description="Create a receipt to increase on-hand stock and resolve low-stock alerts."
          title="No receipts yet"
          action={
            <button
              className="button button-primary"
              onClick={() => setOpen(true)}
              type="button"
            >
              Receive stock
            </button>
          }
        />
      )}
      <ToastRegion toasts={toasts} />
      <ReceiptDrawer
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          void queryClient.invalidateQueries({
            queryKey: ['page', '/inventory/movements'],
          });
          push('Receipt applied to the ledger.', 'success');
        }}
        push={push}
      />
    </section>
  );
}

const movementColumns: TableColumn<MovementRecord>[] = [
  {
    key: 'type',
    label: 'Movement',
    render: (record) => <StatusBadge value={record.type} />,
  },
  {
    key: 'product',
    label: 'Product',
    render: (record) => (
      <span>
        {record.product?.name ?? '—'}
        <small className="muted-note mono">{record.product?.sku}</small>
      </span>
    ),
  },
  {
    key: 'quantityDelta',
    label: 'Quantity',
    render: (record) => <span className="mono">+{record.quantityDelta}</span>,
  },
  {
    key: 'createdAt',
    label: 'When',
    render: (record) => formatDateTime(record.createdAt),
  },
];

function ReceiptDrawer({
  open,
  onClose,
  onSaved,
  push,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  push: (message: string, tone?: ToastMessage['tone']) => void;
}) {
  const products = usePage<ProductRecord>('/products?page=1&pageSize=100');
  const suppliers = usePage<PartnerRecord>('/suppliers?page=1&pageSize=100');
  const form = useForm<z.infer<typeof ReceiptInputSchema>>({
    resolver: zodResolver(ReceiptInputSchema) as never,
    defaultValues: {
      lines: [{ productId: '', quantity: 1, unitCost: null }],
      note: null,
      receiptNumber: `WEB-${Date.now()}`,
      receivedAt: new Date().toISOString(),
      supplierId: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof ReceiptInputSchema>) =>
      apiRequest('/receipts', {
        body: JSON.stringify(value),
        idempotencyKey: newIdempotencyKey('receipt'),
        method: 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not apply the receipt.',
        'error',
      ),
    onSuccess: onSaved,
  });
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="Receipt, ledger movement, balance update, and alert reconciliation commit together."
      onClose={close}
      open={open}
      title="Receive stock"
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) =>
          void form.handleSubmit((value) => mutation.mutate(value))(event)
        }
      >
        <FormField
          error={form.formState.errors.receiptNumber?.message}
          htmlFor="receipt-number"
          label="Receipt number"
        >
          <input id="receipt-number" {...form.register('receiptNumber')} />
        </FormField>
        <FormField
          error={form.formState.errors.supplierId?.message}
          htmlFor="receipt-supplier"
          label="Supplier"
        >
          <select id="receipt-supplier" {...form.register('supplierId')}>
            <option value="">Choose supplier</option>
            {suppliers.data?.items
              .filter((supplier) => supplier.isActive)
              .map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.companyName}
                </option>
              ))}
          </select>
        </FormField>
        <FormField
          error={form.formState.errors.lines?.[0]?.productId?.message}
          htmlFor="receipt-product"
          label="Product"
        >
          <select id="receipt-product" {...form.register('lines.0.productId')}>
            <option value="">Choose product</option>
            {products.data?.items
              .filter((product) => product.isActive)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
          </select>
        </FormField>
        <div className="form-grid">
          <FormField
            error={form.formState.errors.lines?.[0]?.quantity?.message}
            htmlFor="receipt-quantity"
            label="Quantity"
          >
            <input
              id="receipt-quantity"
              min="1"
              type="number"
              {...form.register('lines.0.quantity', { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            error={form.formState.errors.lines?.[0]?.unitCost?.message}
            htmlFor="receipt-cost"
            label="Unit cost"
          >
            <input
              id="receipt-cost"
              placeholder="0.00"
              {...form.register('lines.0.unitCost')}
            />
          </FormField>
        </div>
        <FormField
          error={form.formState.errors.note?.message}
          htmlFor="receipt-note"
          label="Note"
        >
          <textarea id="receipt-note" {...form.register('note')} />
        </FormField>
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? 'Applying…' : 'Apply receipt'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function ProductsWorkspace({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const products = usePage<ProductRecord>(
    `/products?page=1&pageSize=100&search=${encodeURIComponent(search)}`,
  );
  const canWrite = role === 'MANAGER' || role === 'OWNER';
  const mutation = useMutation({
    mutationFn: ({
      id,
      value,
    }: {
      id: string | undefined;
      value: z.infer<typeof ProductInputSchema> & { isActive?: boolean };
    }) =>
      apiRequest(id ? `/products/${id}` : '/products', {
        body: JSON.stringify(value),
        method: id ? 'PATCH' : 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not save product.',
        'error',
      ),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['page', '/products'] });
      push('Product saved.', 'success');
    },
  });
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Maintain SKU, pricing, and reorder points without deleting referenced history."
        title="Products"
        action={
          canWrite ? (
            <button
              className="button button-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              type="button"
            >
              <Plus size={17} /> Add product
            </button>
          ) : undefined
        }
      />
      <SearchFilterBar onSearch={setSearch} search={search} />
      {products.isLoading ? (
        <Skeleton lines={5} />
      ) : products.isError ? (
        <ErrorState
          description="Products could not be loaded."
          onRetry={() => void products.refetch()}
        />
      ) : products.data?.items.length ? (
        <ResponsiveDataTable
          columns={productColumns}
          data={products.data.items}
          getRowLabel={(record) => record.sku}
          onRowClick={
            canWrite
              ? (record) => {
                  setEditing(record);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <EmptyState
          description="Create the first product or import a catalog CSV."
          title="No products yet"
          action={
            canWrite ? (
              <button
                className="button button-primary"
                onClick={() => setFormOpen(true)}
                type="button"
              >
                Add product
              </button>
            ) : undefined
          }
        />
      )}
      <ToastRegion toasts={toasts} />
      <ProductDrawer
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={(value) => mutation.mutate({ id: editing?.id, value })}
        open={formOpen}
        pending={mutation.isPending}
      />
    </section>
  );
}

const productColumns: TableColumn<ProductRecord>[] = [
  {
    key: 'sku',
    label: 'SKU',
    render: (record) => <span className="mono">{record.sku}</span>,
  },
  {
    key: 'name',
    label: 'Product',
    render: (record) => <strong>{record.name}</strong>,
  },
  {
    key: 'salePrice',
    label: 'Sale price',
    render: (record) => <span className="mono">${record.salePrice}</span>,
  },
  {
    key: 'reorderPoint',
    label: 'Reorder point',
    render: (record) => <span className="mono">{record.reorderPoint}</span>,
  },
  {
    key: 'isActive',
    label: 'Lifecycle',
    render: (record) => (
      <StatusBadge value={record.isActive ? 'SUCCEEDED' : 'CANCELLED'} />
    ),
  },
];

function ProductDrawer({
  open,
  editing,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  editing: ProductRecord | null;
  onClose: () => void;
  onSave: (
    value: z.infer<typeof ProductInputSchema> & { isActive?: boolean },
  ) => void;
  pending: boolean;
}) {
  const form = useForm<
    z.infer<typeof ProductInputSchema> & { isActive?: boolean }
  >({
    resolver: zodResolver(ProductInputSchema) as never,
    defaultValues: {
      description: null,
      name: '',
      reorderPoint: 0,
      salePrice: '0.00',
      sku: '',
    },
  });
  useEffect(() => {
    form.reset(
      editing
        ? {
            description: null,
            isActive: editing.isActive,
            name: editing.name,
            reorderPoint: editing.reorderPoint,
            salePrice: editing.salePrice,
            sku: editing.sku,
          }
        : {
            description: null,
            name: '',
            reorderPoint: 0,
            salePrice: '0.00',
            sku: '',
          },
    );
  }, [editing, form]);
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="SKU stays unique inside the current organization."
      onClose={close}
      open={open}
      title={editing ? 'Edit product' : 'Add product'}
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) => void form.handleSubmit(onSave)(event)}
      >
        <div className="form-grid">
          <FormField
            error={form.formState.errors.sku?.message}
            htmlFor="product-sku"
            label="SKU"
          >
            <input id="product-sku" {...form.register('sku')} />
          </FormField>
          <FormField
            error={form.formState.errors.name?.message}
            htmlFor="product-name"
            label="Product name"
          >
            <input id="product-name" {...form.register('name')} />
          </FormField>
        </div>
        <div className="form-grid">
          <FormField
            error={form.formState.errors.salePrice?.message}
            htmlFor="product-price"
            label="Sale price"
          >
            <input
              id="product-price"
              placeholder="0.00"
              {...form.register('salePrice')}
            />
          </FormField>
          <FormField
            error={form.formState.errors.reorderPoint?.message}
            htmlFor="product-reorder"
            label="Reorder point"
          >
            <input
              id="product-reorder"
              min="0"
              type="number"
              {...form.register('reorderPoint', { valueAsNumber: true })}
            />
          </FormField>
        </div>
        <FormField
          error={form.formState.errors.description?.message}
          htmlFor="product-description"
          label="Description"
        >
          <textarea
            id="product-description"
            {...form.register('description')}
          />
        </FormField>
        {editing ? (
          <label className="checkbox-field">
            <input type="checkbox" {...form.register('isActive')} /> Active
            product
          </label>
        ) : null}
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function PartnersWorkspace({ role }: { role: Role }) {
  const [kind, setKind] = useState<'customers' | 'suppliers'>('customers');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerRecord | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const partners = usePage<PartnerRecord>(`/${kind}?page=1&pageSize=100`);
  const canWrite = role === 'MANAGER' || role === 'OWNER';
  const mutation = useMutation({
    mutationFn: ({
      id,
      value,
    }: {
      id: string | undefined;
      value: z.infer<typeof CustomerInputSchema>;
    }) =>
      apiRequest(id ? `/${kind}/${id}` : `/${kind}`, {
        body: JSON.stringify(value),
        method: id ? 'PATCH' : 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not save partner.',
        'error',
      ),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['page', `/${kind}`] });
      push('Partner saved.', 'success');
    },
  });
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Keep customer and supplier records active, searchable, and tenant-scoped."
        title="Partners"
        action={
          canWrite ? (
            <button
              className="button button-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              type="button"
            >
              <Plus size={17} /> Add partner
            </button>
          ) : undefined
        }
      />
      <div
        className="segmented-control"
        role="tablist"
        aria-label="Partner type"
      >
        <button
          aria-selected={kind === 'customers'}
          className={kind === 'customers' ? 'is-active' : undefined}
          onClick={() => setKind('customers')}
          role="tab"
          type="button"
        >
          Customers
        </button>
        <button
          aria-selected={kind === 'suppliers'}
          className={kind === 'suppliers' ? 'is-active' : undefined}
          onClick={() => setKind('suppliers')}
          role="tab"
          type="button"
        >
          Suppliers
        </button>
      </div>
      {partners.isLoading ? (
        <Skeleton lines={4} />
      ) : partners.isError ? (
        <ErrorState
          description="Partners could not be loaded."
          onRetry={() => void partners.refetch()}
        />
      ) : partners.data?.items.length ? (
        <ResponsiveDataTable
          columns={partnerColumns}
          data={partners.data.items}
          getRowLabel={(record) => record.companyName}
          onRowClick={
            canWrite
              ? (record) => {
                  setEditing(record);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <EmptyState
          description={`Create a ${kind === 'customers' ? 'customer' : 'supplier'} to use in operational forms.`}
          title={`No ${kind} yet`}
        />
      )}
      <ToastRegion toasts={toasts} />
      <PartnerDrawer
        editing={editing}
        kind={kind}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={(value) => mutation.mutate({ id: editing?.id, value })}
        open={formOpen}
        pending={mutation.isPending}
      />
    </section>
  );
}

const partnerColumns: TableColumn<PartnerRecord>[] = [
  {
    key: 'companyName',
    label: 'Company',
    render: (record) => <strong>{record.companyName}</strong>,
  },
  { key: 'contactName', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  {
    key: 'isActive',
    label: 'Lifecycle',
    render: (record) => (
      <StatusBadge value={record.isActive ? 'SUCCEEDED' : 'CANCELLED'} />
    ),
  },
];

function PartnerDrawer({
  open,
  editing,
  kind,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  editing: PartnerRecord | null;
  kind: 'customers' | 'suppliers';
  onClose: () => void;
  onSave: (value: z.infer<typeof CustomerInputSchema>) => void;
  pending: boolean;
}) {
  const form = useForm<z.infer<typeof CustomerInputSchema>>({
    resolver: zodResolver(
      kind === 'customers' ? CustomerInputSchema : SupplierInputSchema,
    ) as never,
    defaultValues: {
      companyName: '',
      contactName: null,
      email: null,
      phone: null,
    },
  });
  useEffect(() => {
    form.reset(
      editing
        ? {
            companyName: editing.companyName,
            contactName: editing.contactName,
            email: editing.email,
            phone: editing.phone,
          }
        : { companyName: '', contactName: null, email: null, phone: null },
    );
  }, [editing, form]);
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="Inactive records remain available for historical references."
      onClose={close}
      open={open}
      title={`${editing ? 'Edit' : 'Add'} ${kind === 'customers' ? 'customer' : 'supplier'}`}
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) => void form.handleSubmit(onSave)(event)}
      >
        <FormField
          error={form.formState.errors.companyName?.message}
          htmlFor="partner-company"
          label="Company name"
        >
          <input id="partner-company" {...form.register('companyName')} />
        </FormField>
        <div className="form-grid">
          <FormField
            error={form.formState.errors.contactName?.message}
            htmlFor="partner-contact"
            label="Contact name"
          >
            <input id="partner-contact" {...form.register('contactName')} />
          </FormField>
          <FormField
            error={form.formState.errors.email?.message}
            htmlFor="partner-email"
            label="Email"
          >
            <input
              id="partner-email"
              type="email"
              {...form.register('email')}
            />
          </FormField>
        </div>
        <FormField
          error={form.formState.errors.phone?.message}
          htmlFor="partner-phone"
          label="Phone"
        >
          <input id="partner-phone" {...form.register('phone')} />
        </FormField>
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Saving…' : 'Save partner'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function ImportsWorkspace({ role }: { role: Role }) {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<{
    id: string;
    validRows: number;
    invalidRows: number;
    errors: Array<{ row: number; errors: string[] }>;
  } | null>(null);
  const { push, toasts } = useToasts();
  const previewMutation = useMutation({
    mutationFn: () =>
      apiRequest<{
        id: string;
        validRows: number;
        invalidRows: number;
        errors: Array<{ row: number; errors: string[] }>;
      }>('/product-imports/preview', {
        body: JSON.stringify({ content, fileName }),
        method: 'POST',
      }),
    onError: (error) =>
      push(error instanceof Error ? error.message : 'Preview failed.', 'error'),
    onSuccess: setPreview,
  });
  const commitMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/product-imports/${preview?.id}/commit`, {
        idempotencyKey: newIdempotencyKey('import'),
        method: 'POST',
      }),
    onError: (error) =>
      push(error instanceof Error ? error.message : 'Commit failed.', 'error'),
    onSuccess: () => push('Valid product rows committed.', 'success'),
  });
  if (role === 'STAFF')
    return (
      <section className="workspace-section-page">
        <PageHeader
          description="Imports are managed by the catalog team."
          title="Product imports"
        />
        <EmptyState
          description="Staff can review catalog data but cannot import or change master records."
          title="Manager access required"
        />
      </section>
    );
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Upload → Preview → Commit valid rows → Download errors."
        title="Product imports"
        action={
          <a
            className="button button-secondary"
            href="/api/v1/products/export.csv"
          >
            <DownloadSimple size={17} /> Export catalog
          </a>
        }
      />
      <div className="step-indicator" aria-label="Import steps">
        <span className={!preview ? 'is-active' : 'is-complete'}>
          01 Upload
        </span>
        <span className={preview ? 'is-active' : undefined}>02 Preview</span>
        <span>03 Commit</span>
      </div>
      <article className="import-card">
        <label className="file-drop">
          <UploadSimple size={24} aria-hidden="true" />
          <strong>{fileName || 'Choose a product CSV'}</strong>
          <small>Maximum 2 MB and 5,000 rows</small>
          <input
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              void file.text().then(setContent);
            }}
            type="file"
          />
        </label>
        <button
          className="button button-primary"
          disabled={!content || previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
          type="button"
        >
          {previewMutation.isPending ? 'Previewing…' : 'Preview CSV'}
        </button>
      </article>
      {preview ? (
        <article className="work-panel import-results">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Preview results</p>
              <h2>
                {preview.validRows} valid rows · {preview.invalidRows} errors
              </h2>
            </div>
            <button
              className="button button-primary"
              disabled={commitMutation.isPending || preview.validRows === 0}
              onClick={() => commitMutation.mutate()}
              type="button"
            >
              {commitMutation.isPending ? 'Committing…' : 'Commit valid rows'}
            </button>
          </div>
          {preview.errors.length ? (
            <div className="import-errors">
              {preview.errors.map((error) => (
                <div key={error.row}>
                  <strong>Row {error.row}</strong>
                  <span>{error.errors.join('; ')}</span>
                </div>
              ))}
              <a
                className="text-link"
                href={`/api/v1/product-imports/${preview.id}/errors.csv`}
              >
                Download error CSV
              </a>
            </div>
          ) : (
            <EmptyState
              description="All rows passed validation."
              title="No row errors"
            />
          )}
        </article>
      ) : null}
      <ToastRegion toasts={toasts} />
    </section>
  );
}

export function IntegrationsWorkspace({ role }: { role: Role }) {
  const [selected, setSelected] = useState<IntegrationRecord | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const deliveries = usePage<IntegrationRecord>(
    '/integration-deliveries?page=1&pageSize=100',
  );
  const retry = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/integration-deliveries/${id}/retry`, {
        idempotencyKey: newIdempotencyKey('integration-retry'),
        method: 'POST',
      }),
    onError: (error) =>
      push(error instanceof Error ? error.message : 'Retry failed.', 'error'),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['page', '/integration-deliveries'],
      });
      push('Delivery retry queued.', 'success');
    },
  });
  const canRetry = role === 'MANAGER' || role === 'OWNER';
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Review storefront deliveries, failed payloads, and safe manual retries."
        title="Integrations"
      />
      {deliveries.isLoading ? (
        <Skeleton lines={5} />
      ) : deliveries.isError ? (
        <ErrorState
          description="Integration deliveries could not be loaded."
          onRetry={() => void deliveries.refetch()}
        />
      ) : deliveries.data?.items.length ? (
        <ResponsiveDataTable
          columns={integrationColumns}
          data={deliveries.data.items}
          getRowLabel={(record) => record.externalDeliveryId}
          onRowClick={setSelected}
        />
      ) : (
        <EmptyState
          description="Webhook deliveries will appear here as storefront events arrive."
          title="No deliveries yet"
        />
      )}
      <ToastRegion toasts={toasts} />
      <Drawer
        description={
          selected?.lastError ??
          'Inspect the delivery payload and processing state.'
        }
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={selected?.externalDeliveryId ?? 'Delivery detail'}
      >
        {selected ? (
          <div className="detail-stack">
            <StatusBadge value={selected.status} />
            <dl className="detail-metadata">
              <div>
                <dt>Event</dt>
                <dd>{selected.eventType}</dd>
              </div>
              <div>
                <dt>Attempts</dt>
                <dd className="mono">{selected.attempts}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
            </dl>
            <pre className="payload-preview">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
            {canRetry && selected.status === 'FAILED' ? (
              <button
                className="button button-primary"
                disabled={retry.isPending}
                onClick={() => retry.mutate(selected.id)}
                type="button"
              >
                {retry.isPending ? 'Retrying…' : 'Retry delivery'}
              </button>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}

const integrationColumns: TableColumn<IntegrationRecord>[] = [
  {
    key: 'externalDeliveryId',
    label: 'Delivery',
    render: (record) => (
      <span className="mono">{record.externalDeliveryId}</span>
    ),
  },
  { key: 'eventType', label: 'Event' },
  {
    key: 'status',
    label: 'Status',
    render: (record) => <StatusBadge value={record.status} />,
  },
  {
    key: 'attempts',
    label: 'Attempts',
    render: (record) => <span className="mono">{record.attempts}</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (record) => formatDate(record.createdAt),
  },
];

export function AuditWorkspace() {
  const audit = usePage<AuditRecord>('/audit-events?page=1&pageSize=100');
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Trace actor, action, entity, and time behind every operational change."
        title="Audit trail"
      />
      {audit.isLoading ? (
        <Skeleton lines={5} />
      ) : audit.isError ? (
        <ErrorState
          description="Audit events could not be loaded."
          onRetry={() => void audit.refetch()}
        />
      ) : audit.data?.items.length ? (
        <ResponsiveDataTable
          columns={auditColumns}
          data={audit.data.items}
          getRowLabel={(record) => record.action}
        />
      ) : (
        <EmptyState
          description="Mutation history will appear as the team works."
          title="No audit events yet"
        />
      )}
    </section>
  );
}

const auditColumns: TableColumn<AuditRecord>[] = [
  {
    key: 'action',
    label: 'Action',
    render: (record) => <strong>{record.action}</strong>,
  },
  {
    key: 'entityType',
    label: 'Entity',
    render: (record) => <span className="mono">{record.entityType}</span>,
  },
  {
    key: 'actor',
    label: 'Actor',
    render: (record) => record.actor?.displayName ?? 'System',
  },
  {
    key: 'createdAt',
    label: 'When',
    render: (record) => formatDateTime(record.createdAt),
  },
];

export function SettingsWorkspace({ role }: { role: Role }) {
  const settings = useQuery({
    queryKey: ['organization-settings'],
    queryFn: () =>
      apiRequest<{
        id: string;
        name: string;
        slug: string;
        currency: string;
        isDemo: boolean;
        nextDemoResetAt: string | null;
        warehouse: { id: string; name: string } | null;
      }>('/organization/settings'),
    enabled: role === 'OWNER',
  });
  const team = useQuery({
    queryKey: ['team'],
    queryFn: () =>
      apiRequest<
        Array<{ id: string; displayName: string; email: string; role: Role }>
      >('/team'),
    enabled: role === 'OWNER',
  });
  const { push, toasts } = useToasts();
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useMutation({
    mutationFn: () =>
      apiRequest('/organization/demo-reset', {
        idempotencyKey: newIdempotencyKey('demo-reset'),
        method: 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Demo reset failed.',
        'error',
      ),
    onSuccess: () => {
      setConfirmReset(false);
      push('Demo data reset. Reloading…', 'success');
      window.setTimeout(() => window.location.assign('/app'), 400);
    },
  });
  if (role !== 'OWNER')
    return (
      <section className="workspace-section-page">
        <PageHeader
          description="Organization settings are visible to the Owner demo only."
          title="Organization settings"
        />
        <EmptyState
          description="Manager and Staff continue operating through their assigned workflows."
          title="Owner access required"
        />
      </section>
    );
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Read-only organization visibility and a safe demo reset."
        title="Organization settings"
      />
      {settings.isLoading || team.isLoading ? (
        <Skeleton lines={5} />
      ) : settings.isError || team.isError || !settings.data ? (
        <ErrorState
          description="Organization settings could not be loaded."
          onRetry={() => {
            void settings.refetch();
            void team.refetch();
          }}
        />
      ) : (
        <div className="settings-grid">
          <article className="guidance-card">
            <p className="eyebrow">Organization</p>
            <h2>{settings.data.name}</h2>
            <p className="mono">{settings.data.slug}</p>
            <dl className="detail-metadata">
              <div>
                <dt>Currency</dt>
                <dd>{settings.data.currency}</dd>
              </div>
              <div>
                <dt>Warehouse</dt>
                <dd>{settings.data.warehouse?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Next reset</dt>
                <dd>{formatDateTime(settings.data.nextDemoResetAt)}</dd>
              </div>
            </dl>
            <button
              className="button button-danger"
              onClick={() => setConfirmReset(true)}
              type="button"
            >
              Reset demo data
            </button>
          </article>
          <article className="guidance-card">
            <p className="eyebrow">Team view</p>
            <h2>Canonical demo memberships</h2>
            <div className="team-list">
              {team.data?.map((member) => (
                <div className="team-row" key={member.id}>
                  <span className="user-avatar" aria-hidden="true">
                    {member.displayName
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>{member.email}</small>
                  </span>
                  <StatusBadge
                    value={
                      member.role === 'OWNER'
                        ? 'SUCCEEDED'
                        : member.role === 'MANAGER'
                          ? 'CONFIRMED'
                          : 'DRAFT'
                    }
                  />
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
      <ToastRegion toasts={toasts} />
      <ConfirmDialog
        confirmLabel="Reset demo"
        destructive
        description="All demo operational data is restored to the seeded baseline. The action is idempotent and does not change canonical roles."
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => reset.mutate()}
        open={confirmReset}
        pending={reset.isPending}
        title="Reset demo data?"
      />
    </section>
  );
}

export function MoreWorkspace() {
  const links = [
    ['Products', '/app/products'],
    ['Partners', '/app/partners'],
    ['Receipts', '/app/receipts'],
    ['Imports', '/app/imports'],
    ['Integrations', '/app/integrations'],
    ['Audit', '/app/audit'],
    ['Owner settings', '/app/settings'],
  ] as const;
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Keep the mobile queue focused, then reach supporting workflows here."
        title="More operations"
      />
      <div className="more-grid">
        {links.map(([label, href]) => (
          <Link className="more-link" href={href} key={href}>
            <strong>{label}</strong>
            <ArrowRight size={17} />
          </Link>
        ))}
      </div>
    </section>
  );
}
