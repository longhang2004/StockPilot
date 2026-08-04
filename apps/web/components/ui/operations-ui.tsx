'use client';

import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Funnel,
  MagnifyingGlass,
  WarningCircle,
  X,
  XCircle,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

export function PageHeader({
  eyebrow = 'Operations workspace',
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: 'neutral' | 'attention' | 'positive' | 'danger';
}) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

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

export function SearchFilterBar({
  search,
  onSearch,
  placeholder = 'Search by name, SKU, or ID',
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="search-filter-bar">
      <label className="search-input">
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span className="sr-only">Search</span>
        <input
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={search}
        />
      </label>
      {children ? (
        <div className="filter-controls">
          <Funnel size={17} aria-hidden="true" />
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface TableColumn<T> {
  key: string;
  label: string;
  render?: (record: T) => ReactNode;
}

export function ResponsiveDataTable<T extends { id?: string }>({
  columns,
  data,
  onRowClick,
  getRowLabel,
}: {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: ((record: T) => void) | undefined;
  getRowLabel?: ((record: T) => string) | undefined;
}) {
  if (data.length === 0) return null;
  return (
    <div className="data-surface">
      <div className="responsive-table-wrap">
        <table className="operations-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((record, index) => (
              <tr
                className={onRowClick ? 'is-clickable' : undefined}
                key={record.id ?? `record-${index}`}
                onClick={() => onRowClick?.(record)}
                onKeyDown={(event) => {
                  if (
                    onRowClick &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    onRowClick(record);
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td data-label={column.label} key={column.key}>
                    {column.render
                      ? column.render(record)
                      : String(record[column.key as keyof T] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-record-list">
        {data.map((record, index) => (
          <article
            className={`mobile-record-card${onRowClick ? ' is-clickable' : ''}`}
            key={record.id ?? `mobile-${index}`}
            onClick={() => onRowClick?.(record)}
            onKeyDown={(event) => {
              if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onRowClick(record);
              }
            }}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
          >
            <div className="mobile-record-heading">
              <strong>{getRowLabel?.(record) ?? columns[0]?.label}</strong>
              {columns[0]?.render ? columns[0].render(record) : null}
            </div>
            <dl>
              {columns.slice(1).map((column) => (
                <div key={column.key}>
                  <dt>{column.label}</dt>
                  <dd>
                    {column.render
                      ? column.render(record)
                      : String(record[column.key as keyof T] ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        <CaretLeft size={18} />
      </button>
      <span>
        Page <strong>{page}</strong> of {totalPages}
      </span>
      <button
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        <CaretRight size={18} />
      </button>
    </nav>
  );
}

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'medium',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'medium' | 'wide';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const drawerId = useId();
  const titleId = `drawer-title-${drawerId}`;
  const descriptionId = `drawer-description-${drawerId}`;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="drawer-layer" role="presentation">
      <button
        aria-label="Close drawer"
        className="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`drawer-panel drawer-${size}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key !== 'Tab') return;
          const focusable = Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ) ?? [],
          );
          if (focusable.length === 0) {
            event.preventDefault();
            panelRef.current?.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="drawer-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            aria-label="Close drawer"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Drawer
      description={description}
      onClose={onCancel}
      open={open}
      size="medium"
      title={title}
    >
      <div className="confirm-dialog-copy">
        <WarningCircle size={32} aria-hidden="true" />
        <p>{description}</p>
      </div>
      <div className="confirm-actions">
        <button
          className="button button-secondary"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className={`button ${destructive ? 'button-danger' : 'button-primary'}`}
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? 'Working…' : confirmLabel}
          <ArrowRight size={17} />
        </button>
      </div>
    </Drawer>
  );
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);
  return null;
}
