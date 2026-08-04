'use client';

import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

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
