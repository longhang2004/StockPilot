'use client';

import { type Role } from '@stockpilot/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

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
import { ExpiredCommandResolution } from '../shared/expired-command-resolution';
import { formatDate } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { useCommandMutation } from '../../hooks/use-command-mutation';
import { useWorkspaceLocation } from '../shared/use-workspace-location';
import { OrderTransitionPreview } from './components/order-transition-preview';
import {
  OrderDetailActions,
  OrderDetailView,
} from './components/order-detail-view';
import { OrderFormDrawer } from './components/order-form-drawer';
import { type OrderDetail, type OrderRecord } from '../shared/types';
import './orders.css';

const ORDER_STATUS_VALUES = [
  'DRAFT',
  'CONFIRMED',
  'FULFILLED',
  'CANCELLED',
] as const;

function isOrderId(value: string | null): value is string {
  return Boolean(
    value &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value),
  );
}

function pageFromUrl(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function OrdersWorkspace({ role }: { role: Role }) {
  const location = useWorkspaceLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const searchFromUrl = location.params.get('search') ?? '';
  const requestedStatus = location.params.get('status') ?? '';
  const status = ORDER_STATUS_VALUES.includes(
    requestedStatus as (typeof ORDER_STATUS_VALUES)[number],
  )
    ? requestedStatus
    : '';
  const page = pageFromUrl(location.params.get('page'));
  const selectedId = isOrderId(location.params.get('order'))
    ? location.params.get('order')
    : null;
  const createFormRequested = location.params.get('new') === '1';
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [confirmAction, setConfirmAction] = useState<
    'CANCELLED' | 'CONFIRMED' | 'FULFILLED' | null
  >(null);
  const [pendingDraftRecovery, setPendingDraftRecovery] = useState(false);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();

  useEffect(() => setSearchInput(searchFromUrl), [searchFromUrl]);
  useEffect(() => {
    if (searchInput === searchFromUrl) return;
    const timer = window.setTimeout(() => {
      locationRef.current.update(
        { search: searchInput || null, page: null },
        'replace',
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchFromUrl, searchInput]);

  const list = usePage<OrderRecord>(ORDERS_RESOURCE, {
    page,
    pageSize: 25,
    search: searchFromUrl,
    status,
  });
  const detail = useQuery({
    queryKey: orderKeys.detail(selectedId ?? ''),
    queryFn: () => fetchOrderDetail(selectedId!),
    enabled: Boolean(selectedId),
  });
  const formOpen =
    createFormRequested ||
    Boolean(selectedId && location.params.get('edit') === '1' && detail.data);
  const transition = useCommandMutation<
    { id: string; to: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED' },
    OrderDetail
  >({
    prefix: 'order-transition',
    validate: (
      value,
    ): value is {
      id: string;
      to: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED';
    } =>
      Boolean(
        value &&
        typeof value === 'object' &&
        'id' in value &&
        typeof value.id === 'string' &&
        'to' in value &&
        ['CONFIRMED', 'FULFILLED', 'CANCELLED'].includes(String(value.to)),
      ),
    command: (value, key) => transitionOrder(value.id, value.to, key),
    onError: (error) => {
      setConfirmAction(null);
      push(
        error instanceof Error ? error.message : 'Order transition failed.',
        'error',
      );
    },
    onSuccess: (updated, value) => {
      queryClient.setQueryData(orderKeys.detail(value.id), updated);
      void invalidatePageQueries(queryClient, ORDERS_RESOURCE);
      void invalidatePageQueries(queryClient, '/inventory/balances');
      void invalidatePageQueries(queryClient, '/alerts');
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-trace'] });
      setConfirmAction(null);
      push('Order status updated.', 'success');
    },
  });
  const canManage = role === 'MANAGER' || role === 'OWNER';

  function closeForm() {
    location.update({ new: null, edit: null }, 'replace');
  }

  function openOrder(order: OrderRecord) {
    location.update({ order: order.id }, 'push');
  }

  function onFormSaved(saved: OrderDetail) {
    const isEditing = location.params.get('edit') === '1';
    queryClient.setQueryData(orderKeys.detail(saved.id), saved);
    void invalidatePageQueries(queryClient, ORDERS_RESOURCE);
    if (isEditing) {
      location.update({ edit: null }, 'replace');
      push('Draft order updated.', 'success');
      return;
    }
    location.update({ new: null, edit: null, order: saved.id }, 'replace');
    push('Draft order created.', 'success');
  }

  const selectedOrder = detail.data;
  const recoveryNotice = transition.outcomeUnknown ? (
    <div className="work-panel" role="alert">
      <p>{transition.recoveryMessage}</p>
      {transition.recoveryExpired ? (
        <ExpiredCommandResolution
          idempotencyKey={transition.idempotencyKey}
          onResolve={transition.resolveExpired}
        />
      ) : (
        <button
          className="button button-secondary"
          type="button"
          disabled={transition.isPending}
          onClick={() =>
            transition.variables && transition.mutate(transition.variables)
          }
        >
          Retry same status update
        </button>
      )}
    </div>
  ) : null;
  return (
    <section className="workspace-section-page orders-workspace">
      {!selectedId ? recoveryNotice : null}
      {pendingDraftRecovery ? (
        <div className="work-panel order-create-recovery" role="status">
          <p>
            A Draft request is awaiting an outcome. Resume it to recover safely.
          </p>
          <button
            className="button button-secondary"
            onClick={() =>
              location.update({ order: null, edit: null, new: '1' }, 'push')
            }
            type="button"
          >
            Resume pending Draft request
          </button>
        </div>
      ) : null}
      <>
        <PageHeader
          description="Prepare customer demand, review approvals, and follow fulfillment from one order register."
          title="Sales orders"
          action={
            <button
              className="button button-primary"
              onClick={() => location.update({ new: '1' }, 'push')}
              type="button"
            >
              <Plus size={16} aria-hidden="true" />
              {pendingDraftRecovery ? 'Resume pending Draft' : 'New draft'}
            </button>
          }
        />
        <SearchFilterBar
          onSearch={setSearchInput}
          placeholder="Search order number or customer"
          search={searchInput}
        >
          <label className="orders-status-filter">
            <span>Status</span>
            <select
              aria-label="Filter orders by status"
              onChange={(event) =>
                location.update(
                  {
                    status: event.target.value || null,
                    page: null,
                  },
                  'replace',
                )
              }
              value={status}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="FULFILLED">Fulfilled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </SearchFilterBar>
        <p className="orders-result-count" aria-live="polite">
          {list.isLoading
            ? 'Loading orders…'
            : list.isError
              ? 'Order register unavailable'
              : `${list.data?.total ?? 0} orders`}
        </p>
        {list.isLoading ? (
          <Skeleton lines={5} />
        ) : list.isError ? (
          <ErrorState
            description="Orders could not be loaded. Your filters remain in the address bar."
            onRetry={() => void list.refetch()}
          />
        ) : list.data?.items.length ? (
          <>
            <ResponsiveDataTable
              ariaLabel="Sales orders"
              columns={orderColumns}
              data={list.data.items}
              getRowLabel={(record) => record.orderNumber}
              onRowClick={openOrder}
            />
            <Pagination
              onPageChange={(nextPage) =>
                location.update({
                  page: nextPage === 1 ? null : String(nextPage),
                })
              }
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
                onClick={() => location.update({ new: '1' }, 'push')}
                type="button"
              >
                Create draft
              </button>
            }
          />
        )}
      </>
      <Drawer
        key={selectedId ?? 'order-detail'}
        open={Boolean(selectedId) && !formOpen && !confirmAction}
        title={selectedOrder?.orderNumber ?? 'Order detail'}
        description={selectedOrder?.customerCompanyName}
        size="wide"
        onClose={() => location.update({ order: null, edit: null }, 'replace')}
        footer={
          selectedOrder ? (
            <OrderDetailActions
              detail={selectedOrder}
              canManage={canManage}
              canEditDraft={selectedOrder.status === 'DRAFT'}
              onEdit={() => location.update({ edit: '1' }, 'push')}
              onAction={setConfirmAction}
              pending={transition.locked}
            />
          ) : undefined
        }
      >
        {recoveryNotice}
        {detail.isLoading ? (
          <div className="order-object-page">
            <button
              className="button button-secondary"
              onClick={() => location.update({ order: null }, 'replace')}
              type="button"
            >
              Back to orders
            </button>
            <Skeleton lines={7} />
          </div>
        ) : detail.isError || !selectedOrder ? (
          <div className="order-object-page">
            <button
              className="button button-secondary"
              onClick={() => location.update({ order: null }, 'replace')}
              type="button"
            >
              Back to orders
            </button>
            <ErrorState
              description="This order could not be loaded or is no longer available in this workspace."
              onRetry={() => void detail.refetch()}
            />
          </div>
        ) : (
          <OrderDetailView
            checkStock
            hideActions
            detail={selectedOrder}
            {...(location.params.get('returnTo')
              ? { returnTo: location.params.get('returnTo')! }
              : {})}
            canManage={canManage}
            canEditDraft={selectedOrder.status === 'DRAFT'}
            onBack={() =>
              location.update({ order: null, edit: null }, 'replace')
            }
            onEdit={() => location.update({ edit: '1' }, 'push')}
            onAction={(to) => {
              setConfirmAction(to);
            }}
            pending={transition.locked}
            role={role}
          />
        )}
      </Drawer>
      <ToastRegion toasts={toasts} />
      <OrderFormDrawer
        open={formOpen}
        order={location.params.get('edit') === '1' ? selectedOrder : undefined}
        onClose={closeForm}
        onSaved={onFormSaved}
        onRecoveryChange={setPendingDraftRecovery}
        onConflictRefresh={
          selectedOrder
            ? () =>
                queryClient.fetchQuery({
                  queryKey: orderKeys.detail(selectedOrder.id),
                  queryFn: () => fetchOrderDetail(selectedOrder.id),
                  staleTime: 0,
                })
            : undefined
        }
        push={push}
      />
      {selectedOrder &&
      (confirmAction === 'CONFIRMED' || confirmAction === 'FULFILLED') ? (
        <OrderTransitionPreview
          detail={selectedOrder}
          target={confirmAction}
          pending={transition.locked}
          onClose={() => setConfirmAction(null)}
          onConfirm={() =>
            transition.mutate({ id: selectedOrder.id, to: confirmAction })
          }
        />
      ) : null}
      <ConfirmDialog
        confirmLabel="Cancel order"
        destructive
        description="This releases any confirmed reservation and permanently ends the order."
        onCancel={() => setConfirmAction(null)}
        onConfirm={() =>
          selectedOrder &&
          transition.mutate({ id: selectedOrder.id, to: 'CANCELLED' })
        }
        open={confirmAction === 'CANCELLED'}
        pending={transition.locked}
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
