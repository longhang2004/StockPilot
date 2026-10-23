'use client';

import { ArrowLeft, PencilSimple } from '@phosphor-icons/react';
import { type Role } from '@stockpilot/contracts';
import Link from 'next/link';

import { StatusBadge } from '../../../components/ui/operations-ui';
import { formatDateTime, formatMoney } from '../../../lib/formatters';
import { type OrderDetail } from '../../shared/types';
import { OrderStockAvailability } from './order-transition-preview';

export function OrderDetailView({
  detail,
  hideActions = false,
  checkStock = false,
  canManage,
  canEditDraft,
  onAction,
  onBack,
  onEdit,
  pending,
  returnTo,
  role,
}: {
  detail: OrderDetail;
  hideActions?: boolean;
  checkStock?: boolean;
  canManage: boolean;
  canEditDraft: boolean;
  onAction: (to: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED') => void;
  onBack: () => void;
  onEdit: () => void;
  pending: boolean;
  returnTo?: string;
  role: Role;
}) {
  const deliveryReturnPath = safeDeliveryReturnPath(returnTo);
  return (
    <article className="order-object-page">
      {deliveryReturnPath ? (
        <Link
          className="button button-quiet order-object-back"
          href={deliveryReturnPath}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to delivery
        </Link>
      ) : (
        <button
          className="button button-quiet order-object-back"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to orders
        </button>
      )}
      <header className="order-object-header">
        <div className="order-object-title-block">
          {!hideActions ? <h1>{detail.orderNumber}</h1> : null}
          <div className="order-object-status-line">
            <StatusBadge value={detail.status} />
            <span>Updated {formatDateTime(detail.updatedAt)}</span>
          </div>
        </div>
        {!hideActions ? (
          <OrderDetailActions
            detail={detail}
            canManage={canManage}
            canEditDraft={canEditDraft}
            onEdit={onEdit}
            onAction={onAction}
            pending={pending}
          />
        ) : null}
      </header>

      <ol className="order-progress" aria-label="Order progress">
        {['DRAFT', 'CONFIRMED', 'FULFILLED'].map((step, index) => (
          <li
            key={step}
            aria-current={detail.status === step ? 'step' : undefined}
            className={
              detail.status !== 'CANCELLED' &&
              ['DRAFT', 'CONFIRMED', 'FULFILLED'].indexOf(detail.status) >=
                index
                ? 'is-complete'
                : ''
            }
          >
            <span>{index + 1}</span>
            {step === 'DRAFT'
              ? 'Draft'
              : step === 'CONFIRMED'
                ? 'Confirmed'
                : 'Fulfilled'}
          </li>
        ))}
      </ol>
      {detail.status === 'CANCELLED' ? (
        <p className="muted-note">
          This order is cancelled. No stock is held for this order.
        </p>
      ) : null}
      {role === 'STAFF' && detail.status === 'CONFIRMED' ? (
        <p className="order-object-permission-note">
          Staff can fulfill confirmed work. Manager approval is required before
          a Draft can be confirmed.
        </p>
      ) : null}

      <section
        aria-labelledby="order-lines-title"
        className="order-object-section"
      >
        <div className="order-object-section-heading">
          <h2 id="order-lines-title">Order lines</h2>
          <span>{detail.lines.length} lines</span>
        </div>
        <div className="data-surface order-lines-surface">
          <div className="responsive-table-wrap">
            <table aria-label="Order lines" className="operations-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" className="order-number-cell">
                    Quantity
                  </th>
                  <th scope="col" className="order-number-cell">
                    Unit price
                  </th>
                  <th scope="col" className="order-number-cell">
                    Line total
                  </th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.id}>
                    <td data-label="Product">
                      <strong>{line.productNameSnapshot}</strong>
                      <small className="order-line-sku mono">
                        {line.skuSnapshot}
                      </small>
                    </td>
                    <td
                      className="order-number-cell mono"
                      data-label="Quantity"
                    >
                      {line.quantity}
                    </td>
                    <td
                      className="order-number-cell mono"
                      data-label="Unit price"
                    >
                      {formatMoney(line.unitPrice)}
                    </td>
                    <td
                      className="order-number-cell mono"
                      data-label="Line total"
                    >
                      {formatMoney(line.lineTotal)}
                    </td>
                    <td data-label="Source">
                      <Link
                        className="order-object-link"
                        href={`/app/inventory?product=${encodeURIComponent(line.productId)}`}
                      >
                        View stock trace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3} scope="row">
                    Order total
                  </th>
                  <td className="order-number-cell mono">
                    {formatMoney(detail.subtotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {checkStock && ['DRAFT', 'CONFIRMED'].includes(detail.status) ? (
        <OrderStockAvailability detail={detail} />
      ) : null}
      <section
        aria-labelledby="order-facts-title"
        className="order-object-section"
      >
        <h2 id="order-facts-title">Order information</h2>
        <dl className="order-facts-grid">
          <div>
            <dt>Customer</dt>
            <dd>{detail.customerCompanyName}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{detail.customerContactName ?? 'No contact provided'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{detail.customerEmail ?? 'No email provided'}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(detail.createdAt)}</dd>
          </div>
          <div>
            <dt>Warehouse</dt>
            <dd>
              {detail.warehouseName ?? 'Unknown warehouse'}
              <small className="order-fact-id mono">{detail.warehouseId}</small>
            </dd>
          </div>
          <div>
            <dt>Created by</dt>
            <dd>
              {detail.createdByName ?? 'Unknown user'}
              <small className="order-fact-id mono">
                {detail.createdByUserId}
              </small>
            </dd>
          </div>
          <div>
            <dt>Order total</dt>
            <dd className="mono">{formatMoney(detail.subtotal)}</dd>
          </div>
        </dl>
        {detail.note ? (
          <div className="order-object-note">
            <h3>Order note</h3>
            <p>{detail.note}</p>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="order-activity-title"
        className="order-object-section"
      >
        <div className="order-object-section-heading">
          <h2 id="order-activity-title">Activity</h2>
          <Link
            className="order-object-link"
            href={`/app/audit?entityType=SalesOrder&entityId=${encodeURIComponent(detail.id)}`}
          >
            View audit history
          </Link>
        </div>
        {detail.transitions.length ? (
          <ol className="order-activity-list">
            {detail.transitions.map((transition) => (
              <li key={transition.id}>
                <span className="order-activity-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {transition.fromStatus
                      ? `${transition.fromStatus} to ${transition.toStatus}`
                      : `Order created as ${transition.toStatus}`}
                  </strong>
                  {transition.note ? <p>{transition.note}</p> : null}
                  <time dateTime={transition.createdAt}>
                    {formatDateTime(transition.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted-note">No order activity has been recorded.</p>
        )}
      </section>
    </article>
  );
}

function safeDeliveryReturnPath(value?: string): string | undefined {
  if (!value?.startsWith('/app/integrations?')) return undefined;
  const target = new URL(value, 'https://stockpilot.invalid');
  return target.origin === 'https://stockpilot.invalid' &&
    target.pathname === '/app/integrations' &&
    target.searchParams.has('delivery')
    ? `${target.pathname}${target.search}`
    : undefined;
}

export function OrderDetailActions({
  detail,
  canManage,
  canEditDraft,
  onEdit,
  onAction,
  pending,
}: {
  detail: OrderDetail;
  canManage: boolean;
  canEditDraft: boolean;
  onEdit: () => void;
  onAction: (to: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED') => void;
  pending: boolean;
}) {
  return (
    <div className="order-object-actions">
      {canEditDraft && detail.status === 'DRAFT' ? (
        <button
          className="button button-secondary"
          onClick={onEdit}
          type="button"
        >
          <PencilSimple size={16} aria-hidden="true" /> Edit draft
        </button>
      ) : null}
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
    </div>
  );
}
