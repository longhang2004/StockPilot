'use client';

import { ArrowUpRight, CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
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
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
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
  ariaLabel = 'Data table',
}: {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: ((record: T) => void) | undefined;
  getRowLabel?: ((record: T) => string) | undefined;
  ariaLabel?: string;
}) {
  if (data.length === 0) return null;
  const hasRowAction = Boolean(onRowClick);
  const rowLabel = (record: T, index: number) =>
    getRowLabel?.(record) ?? `${columns[0]?.label ?? 'Record'} ${index + 1}`;
  const primaryColumn = columns[0];
  const primaryValue = (record: T) =>
    primaryColumn?.render
      ? primaryColumn.render(record)
      : String((primaryColumn && record[primaryColumn.key as keyof T]) ?? '—');
  const shouldShowPrimary = (record: T, index: number) => {
    if (!primaryColumn) return false;
    const rawValue = record[primaryColumn.key as keyof T];
    return typeof rawValue !== 'string' || rawValue !== rowLabel(record, index);
  };

  return (
    <div className="data-surface" role="region" aria-label={ariaLabel}>
      <div className="responsive-table-wrap">
        <table aria-label={ariaLabel} className="operations-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
              {hasRowAction ? <th scope="col">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.map((record, index) => (
              <tr key={record.id ?? `record-${index}`}>
                {columns.map((column) => (
                  <td data-label={column.label} key={column.key}>
                    {column.render
                      ? column.render(record)
                      : String(record[column.key as keyof T] ?? '—')}
                  </td>
                ))}
                {onRowClick ? (
                  <td className="table-action-cell">
                    <button
                      aria-label={`Open ${rowLabel(record, index)}`}
                      className="table-row-action"
                      onClick={() => onRowClick(record)}
                      type="button"
                    >
                      Open <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-record-list">
        {data.map((record, index) => (
          <article
            aria-label={onRowClick ? rowLabel(record, index) : undefined}
            className="mobile-record-card"
            key={record.id ?? `mobile-${index}`}
          >
            <div className="mobile-record-heading">
              <strong>{rowLabel(record, index)}</strong>
              {shouldShowPrimary(record, index) ? (
                <span className="mobile-record-primary">
                  {primaryValue(record)}
                </span>
              ) : null}
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
            {onRowClick ? (
              <button
                aria-label={`Open ${rowLabel(record, index)}`}
                className="mobile-record-action"
                onClick={() => onRowClick(record)}
                type="button"
              >
                Open <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            ) : null}
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
