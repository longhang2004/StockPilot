'use client';

import type {
  ReceiptDetail,
  ReceiptSummary,
  Role,
} from '@stockpilot/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  ResponsiveDataTable,
  SearchFilterBar,
  Skeleton,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { formatDateTime, formatMoney } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { useWorkspaceLocation } from '../shared/use-workspace-location';
import { ReceiptDrawer } from './receipt-drawer';
import { fetchReceipt, RECEIPTS_RESOURCE } from './api';

export function ReceiptsWorkspace({ role }: { role: Role }) {
  const { params, update } = useWorkspaceLocation();
  const receiptId = params.get('receipt');
  const productId = params.get('product');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(Number(params.get('page') || 1));
  const [search, setSearch] = useState(params.get('search') || '');
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const canReceive = role === 'MANAGER' || role === 'OWNER';
  const receipts = usePage<ReceiptSummary>(RECEIPTS_RESOURCE, {
    page,
    pageSize: 25,
    search,
  });
  const detail = useQuery({
    queryKey: ['receipt-detail', receiptId],
    queryFn: () => fetchReceipt(receiptId!),
    enabled: Boolean(receiptId),
  });
  useEffect(() => {
    setPage(Number(params.get('page') || 1));
    setSearch(params.get('search') || '');
  }, [params]);

  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Review receipt documents and follow each line into its live SKU trace."
        title={receiptId ? 'Receipt detail' : 'Goods receipts'}
        action={
          canReceive && !receiptId ? (
            <button
              className="button button-primary"
              onClick={() => setOpen(true)}
              type="button"
            >
              <Plus size={16} /> Receive stock
            </button>
          ) : undefined
        }
      />
      {receiptId ? (
        <>
          <button
            className="button button-secondary"
            onClick={() => update({ receipt: null }, 'push')}
            type="button"
          >
            <ArrowLeft size={16} /> All receipts
          </button>
          {detail.isLoading ? (
            <Skeleton lines={5} />
          ) : detail.isError ? (
            <ErrorState
              description="Receipt details could not be loaded."
              onRetry={() => void detail.refetch()}
            />
          ) : detail.data ? (
            <ReceiptObject receipt={detail.data} />
          ) : null}
        </>
      ) : (
        <>
          <SearchFilterBar
            onSearch={(value) => {
              setPage(1);
              setSearch(value);
              update({ search: value || null, page: null }, 'replace');
            }}
            placeholder="Search receipt number or supplier"
            search={search}
          />
          {receipts.isLoading ? (
            <Skeleton lines={5} />
          ) : receipts.isError ? (
            <ErrorState
              description="Receipt documents could not be loaded."
              onRetry={() => void receipts.refetch()}
            />
          ) : receipts.data?.items.length ? (
            <>
              <p className="muted-note">
                {receipts.data.total} receipt documents match this view
              </p>
              <ResponsiveDataTable
                ariaLabel="Receipt documents"
                columns={receiptColumns}
                data={receipts.data.items}
                getRowLabel={(record) => record.receiptNumber}
                onRowClick={(record) => update({ receipt: record.id }, 'push')}
              />
              <Pagination
                onPageChange={(value) => {
                  setPage(value);
                  update(
                    { page: value === 1 ? null : String(value) },
                    'replace',
                  );
                }}
                page={page}
                totalPages={receipts.data.totalPages}
              />
            </>
          ) : (
            <EmptyState
              description="Create a receipt to increase on-hand stock and resolve low-stock alerts."
              title={
                search ? 'No receipts match this search' : 'No receipts yet'
              }
            />
          )}
        </>
      )}
      <ToastRegion toasts={toasts} />
      {canReceive ? (
        <ReceiptDrawer
          open={open}
          {...(productId ? { initialProductId: productId } : {})}
          onClose={() => setOpen(false)}
          onSaved={(savedReceiptId) => {
            setOpen(false);
            update({ receipt: savedReceiptId }, 'push');
            void invalidatePageQueries(queryClient, RECEIPTS_RESOURCE);
            void invalidatePageQueries(queryClient, '/inventory/movements');
            void invalidatePageQueries(queryClient, '/inventory/balances');
            void invalidatePageQueries(queryClient, '/alerts');
            void queryClient.invalidateQueries({
              queryKey: ['inventory-summary'],
            });
            void queryClient.invalidateQueries({
              queryKey: ['inventory-trace'],
            });
            push('Receipt applied to the ledger.', 'success');
          }}
          push={push}
        />
      ) : null}
    </section>
  );
}

function ReceiptObject({ receipt }: { receipt: ReceiptDetail }) {
  return (
    <article className="work-panel detail-stack">
      <dl className="detail-metadata">
        <div>
          <dt>Receipt number</dt>
          <dd className="mono">{receipt.receiptNumber}</dd>
        </div>
        <div>
          <dt>Supplier</dt>
          <dd>{receipt.supplier.companyName}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>{formatDateTime(receipt.receivedAt)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd className="mono">{receipt.id}</dd>
        </div>
        <div>
          <dt>Note</dt>
          <dd>{receipt.note || '—'}</dd>
        </div>
      </dl>
      <h2>Receipt lines</h2>
      <p className="muted-note">
        On-hand quantities below show the moment this receipt was recorded. Open
        a SKU to see its current stock.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th className="numeric">Quantity</th>
              <th className="numeric">Unit cost</th>
              <th className="numeric">On hand before</th>
              <th className="numeric">On hand after</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <Link
                    className="mono"
                    href={`/app/inventory?product=${encodeURIComponent(line.productId)}`}
                  >
                    {line.product.sku}
                  </Link>
                </td>
                <td>{line.product.name}</td>
                <td className="numeric mono">{line.quantity}</td>
                <td className="numeric mono">
                  {line.unitCost ? formatMoney(Number(line.unitCost)) : '—'}
                </td>
                <td className="numeric mono">
                  {line.onHandBefore ?? 'Unavailable'}
                </td>
                <td className="numeric mono">
                  {line.onHandAfter ?? 'Unavailable'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

const receiptColumns: TableColumn<ReceiptSummary>[] = [
  {
    key: 'receiptNumber',
    label: 'Receipt',
    render: (item) => <strong className="mono">{item.receiptNumber}</strong>,
  },
  {
    key: 'supplier',
    label: 'Supplier',
    render: (item) => item.supplier.companyName,
  },
  {
    key: 'receivedAt',
    label: 'Received',
    render: (item) => formatDateTime(item.receivedAt),
  },
  {
    key: 'lineCount',
    label: 'Lines',
    align: 'right',
    render: (item) => <span className="mono">{item.lineCount}</span>,
  },
  {
    key: 'totalQuantity',
    label: 'Units',
    align: 'right',
    render: (item) => <span className="mono">{item.totalQuantity}</span>,
  },
];
