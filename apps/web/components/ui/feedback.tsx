'use client';

import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

const statusLabels: Record<string, string> = {
  ADJUSTMENT_IN: 'Adjustment in',
  ADJUSTMENT_OUT: 'Adjustment out',
  CANCELLED: 'Cancelled',
  CONFIRMED: 'Confirmed',
  DRAFT: 'Draft',
  FAILED: 'Failed',
  FULFILLED: 'Fulfilled',
  OPEN: 'Open',
  PROCESSING: 'Processing',
  RECEIVED: 'Received',
  RECEIPT: 'Receipt',
  RESOLVED: 'Resolved',
  SALE: 'Sale',
  SUCCEEDED: 'Succeeded',
};

export function StatusBadge({ value }: { value: string }) {
  const label = statusLabels[value] ?? value.replaceAll('_', ' ');
  return (
    <span className={`status-badge status-${value.toLowerCase()}`}>
      <span className="status-badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-card state-empty">
      <div className="state-icon" aria-hidden="true">
        <CheckCircle size={20} weight="regular" />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Could not load this view',
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-card state-error" role="alert">
      <div className="state-icon" aria-hidden="true">
        <XCircle size={20} weight="regular" />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {onRetry ? (
        <button
          className="button button-secondary"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }, (_, index) => (
        <span className="skeleton-line" key={index} />
      ))}
    </div>
  );
}

export interface ToastMessage {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

export function ToastRegion({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id}>
          {toast.tone === 'success' ? <CheckCircle size={18} /> : null}
          {toast.tone === 'error' ? <XCircle size={18} /> : null}
          {toast.tone === 'info' ? <WarningCircle size={18} /> : null}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
