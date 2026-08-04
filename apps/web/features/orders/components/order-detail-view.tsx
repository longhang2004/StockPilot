'use client';

import { type Role } from '@stockpilot/contracts';

import { StatusBadge } from '../../../components/ui/operations-ui';
import { formatDateTime } from '../../../lib/formatters';
import { type OrderDetail } from '../../shared/types';

export function OrderDetailView({
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
