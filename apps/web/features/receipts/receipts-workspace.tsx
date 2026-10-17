'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { useState } from 'react';

import {
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
import { formatDateTime } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { type MovementRecord } from '../shared/types';
import { MOVEMENTS_RESOURCE } from './api';
import { ReceiptDrawer } from './receipt-drawer';

/**
 * Goods receipts page: shows receipt movements from the append-only ledger
 * and mounts the receipt creation drawer. The drawer owns the form and the
 * create mutation; this page owns list state and post-save invalidation.
 */
export function ReceiptsWorkspace() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const movements = usePage<MovementRecord>(MOVEMENTS_RESOURCE, {
    page,
    pageSize: 25,
    search,
    type: 'RECEIPT',
  });
  const receipts = movements.data?.items ?? [];
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
            <Plus size={16} /> Receive stock
          </button>
        }
      />
      <SearchFilterBar
        onSearch={(value) => {
          setPage(1);
          setSearch(value);
        }}
        placeholder="Search SKU or product"
        search={search}
      />
      {movements.data ? (
        <p className="muted-note">
          {movements.data.total} receipt movements match this view
        </p>
      ) : null}
      {movements.isLoading ? (
        <Skeleton lines={4} />
      ) : movements.isError ? (
        <ErrorState
          description="Receipt history could not be loaded."
          onRetry={() => void movements.refetch()}
        />
      ) : receipts.length ? (
        <ResponsiveDataTable
          ariaLabel="Receipt movements"
          columns={movementColumns}
          data={receipts}
          getRowLabel={(record) => record.product?.sku ?? record.id}
        />
      ) : (
        <EmptyState
          description={
            search
              ? 'Try another SKU or product name.'
              : 'Create a receipt to increase on-hand stock and resolve low-stock alerts.'
          }
          title={search ? 'No receipts match this search' : 'No receipts yet'}
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
      <Pagination
        onPageChange={setPage}
        page={page}
        totalPages={movements.data?.totalPages ?? 0}
      />
      <ToastRegion toasts={toasts} />
      <ReceiptDrawer
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          void invalidatePageQueries(queryClient, MOVEMENTS_RESOURCE);
          void invalidatePageQueries(queryClient, '/inventory/balances');
          void invalidatePageQueries(queryClient, '/alerts');
          void queryClient.invalidateQueries({
            queryKey: ['inventory-summary'],
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
        <strong>{record.product?.name ?? '—'}</strong>
        <small
          className="muted-note mono"
          style={{ display: 'block', marginTop: '0.1rem' }}
        >
          {record.product?.sku}
        </small>
      </span>
    ),
  },
  {
    key: 'quantityDelta',
    label: 'Quantity',
    align: 'right',
    render: (record) => <span className="mono">+{record.quantityDelta}</span>,
  },
  {
    key: 'createdAt',
    label: 'When',
    align: 'right',
    render: (record) => formatDateTime(record.createdAt),
  },
];
