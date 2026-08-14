'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { useState } from 'react';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
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
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const movements = usePage<MovementRecord>(MOVEMENTS_RESOURCE, {
    page: 1,
    pageSize: 100,
  });
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
        <ResponsiveDataTable
          ariaLabel="Receipt movements"
          columns={movementColumns}
          data={receipts}
          getRowLabel={(record) => record.product?.sku ?? record.id}
        />
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
          void invalidatePageQueries(queryClient, MOVEMENTS_RESOURCE);
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
