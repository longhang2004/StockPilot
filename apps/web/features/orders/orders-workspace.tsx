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
import {
  fetchOrderDetail,
  ORDERS_RESOURCE,
  orderKeys,
  transitionOrder,
} from './api';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { OrderDetailView } from './components/order-detail-view';
import { OrderFormDrawer } from './components/order-form-drawer';
import { type OrderRecord } from '../shared/types';

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
  const list = usePage<OrderRecord>('/orders', {
    page,
    pageSize: 25,
    search,
    status,
  });
  const detail = useQuery({
    queryKey: orderKeys.detail(selectedId!),
    queryFn: () => fetchOrderDetail(selectedId!),
    enabled: Boolean(selectedId),
  });
  const transition = useMutation({
    mutationFn: (to: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED') =>
      transitionOrder(selectedId!, to),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Order transition failed.',
        'error',
      ),
    onSuccess: () => {
      void invalidatePageQueries(queryClient, ORDERS_RESOURCE);
      void queryClient.invalidateQueries({
        queryKey: orderKeys.detail(selectedId!),
      });
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
            <Plus size={16} /> New draft
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
            selectedId={selectedId}
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
          void invalidatePageQueries(queryClient, ORDERS_RESOURCE);
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
