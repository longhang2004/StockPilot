'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Drawer } from '../../../components/ui/overlays';
import { ErrorState, Skeleton } from '../../../components/ui/operations-ui';
import { fetchProductTrace } from '../../inventory/api';
import type { OrderDetail } from '../../shared/types';

export function useOrderStock(detail: OrderDetail) {
  return useQuery({
    queryKey: ['order-stock-preview', detail.id, detail.updatedAt],
    queryFn: async () => {
      const rows = [];
      for (let start = 0; start < detail.lines.length; start += 8) {
        rows.push(
          ...(await Promise.all(
            detail.lines.slice(start, start + 8).map(async (line) => {
              const trace = await fetchProductTrace(line.productId, {
                reservationsPage: 1,
                movementsPage: 1,
              });
              return { line, balance: trace.balance };
            }),
          )),
        );
      }
      return rows;
    },
    staleTime: 0,
    retry: false,
  });
}

export function OrderStockAvailability({ detail }: { detail: OrderDetail }) {
  const stock = useOrderStock(detail);
  if (!['DRAFT', 'CONFIRMED'].includes(detail.status)) return null;
  return (
    <section
      className="order-stock-availability"
      aria-label="Line stock availability"
    >
      <h3>Stock availability</h3>
      {stock.isLoading ? (
        <Skeleton lines={2} />
      ) : stock.isError ? (
        <ErrorState
          description="Current availability could not be checked."
          onRetry={() => void stock.refetch()}
        />
      ) : (
        stock.data?.map(({ line, balance }) => (
          <div key={line.id}>
            <span>{line.productNameSnapshot}</span>
            <strong
              className={
                detail.status === 'DRAFT' &&
                (!balance || balance.available < line.quantity)
                  ? 'form-error'
                  : ''
              }
            >
              {!balance
                ? 'Balance unavailable'
                : detail.status === 'CONFIRMED'
                  ? `${line.quantity} reserved for this order`
                  : balance.available < line.quantity
                    ? `Short by ${line.quantity - balance.available} · ${balance.available} available`
                    : `${balance.available} available · ${line.quantity} needed`}
            </strong>
          </div>
        ))
      )}
    </section>
  );
}

export function OrderTransitionPreview({
  detail,
  target,
  pending,
  onClose,
  onConfirm,
  recovery,
}: {
  detail: OrderDetail;
  target: 'CONFIRMED' | 'FULFILLED';
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recovery?: ReactNode;
}) {
  const stock = useOrderStock(detail);
  const confirming = target === 'CONFIRMED';
  const invalid = stock.data?.some(
    ({ line, balance }) =>
      !balance ||
      (confirming
        ? balance.available < line.quantity
        : balance.reserved < line.quantity || balance.onHand < line.quantity),
  );
  return (
    <Drawer
      open
      title={confirming ? 'Confirm & reserve stock' : 'Fulfill this order'}
      description={`${detail.orderNumber} · ${detail.customerCompanyName}`}
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Back to order
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={
              pending ||
              stock.isFetching ||
              stock.isError ||
              !stock.data?.length ||
              invalid
            }
            onClick={onConfirm}
          >
            {pending
              ? 'Working…'
              : confirming
                ? 'Confirm & reserve'
                : 'Fulfill order'}
          </button>
        </>
      }
    >
      <p className="stock-impact-intro">
        {confirming
          ? 'Reserve these quantities for this customer. Physical stock stays in the warehouse.'
          : 'Record the dispatch. On-hand and reserved quantities decrease together.'}
      </p>
      <p className="muted-note">
        Preview of current stock. Availability is checked again when this action
        is applied.
      </p>
      {recovery}
      {stock.isLoading ? (
        <Skeleton lines={5} />
      ) : stock.isError ? (
        <ErrorState
          description="Current stock could not be checked. Reload before continuing."
          onRetry={() => void stock.refetch()}
        />
      ) : (
        stock.data?.map(({ line, balance }) => {
          const shortage = !balance
            ? line.quantity
            : Math.max(0, line.quantity - balance.available);
          const onHand = balance?.onHand ?? 0;
          const reserved = balance?.reserved ?? 0;
          const available = balance?.available ?? 0;
          const after = {
            onHand: confirming ? onHand : onHand - line.quantity,
            reserved: confirming
              ? reserved + line.quantity
              : reserved - line.quantity,
            available: confirming ? available - line.quantity : available,
          };
          return (
            <section className="stock-impact-item" key={line.id}>
              <header>
                <div>
                  <h3>{line.productNameSnapshot}</h3>
                  <span className="mono">{line.skuSnapshot}</span>
                </div>
                <strong>{line.quantity} units</strong>
              </header>
              {!balance ? (
                <p className="form-error">
                  Stock balance unavailable. Review the product before
                  continuing.
                </p>
              ) : confirming && shortage > 0 ? (
                <p className="form-error">
                  Short by {shortage} units. Receive stock or update the draft.
                </p>
              ) : null}
              <table aria-label={`Stock impact for ${line.skuSnapshot}`}>
                <thead>
                  <tr>
                    <th scope="col">Quantity</th>
                    <th scope="col">Current</th>
                    <th scope="col">
                      After {confirming ? 'confirmation' : 'fulfillment'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['On hand', onHand, after.onHand],
                      ['Reserved', reserved, after.reserved],
                      ['Available', available, after.available],
                    ] as const
                  ).map(([label, before, next]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{before}</td>
                      <td>{next < 0 ? '—' : next}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </Drawer>
  );
}
