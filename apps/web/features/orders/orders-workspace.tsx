'use client';

import { type Role } from '@stockpilot/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  ResponsiveDataTable,
  SearchFilterBar,
  Skeleton,
  StatusBadge,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { apiRequest, newIdempotencyKey } from '../../lib/api-client';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { OrderDetailView } from './components/order-detail-view';
import { OrderFormDrawer } from './components/order-form-drawer';
import { type OrderDetail, type OrderRecord } from '../shared/types';

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
      apiRequest<OrderDetail>(
        `/orders/${selectedId}/${transitionPathByStatus[to]}`,
        {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(`order-${to.toLowerCase()}`),
        },
      ),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Order transition failed.',
        'error',
      ),
    onSuccess: () => {
      void invalidatePageQueries(queryClient, '/orders');
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
          void invalidatePageQueries(queryClient, '/orders');
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

const transitionPathByStatus = {
  CANCELLED: 'cancel',
  CONFIRMED: 'confirm',
  FULFILLED: 'fulfill',
} as const;

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
