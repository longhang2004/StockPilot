'use client';

import { ArrowUpRight, CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
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
  tone?: 'neutral' | 'attention' | 'positive' | 'danger' | undefined;
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
  align?: 'left' | 'right' | 'center' | undefined;
  render?: ((record: T) => ReactNode) | undefined;
}

export function ResponsiveDataTable<T extends { id?: string }>({
  columns,
  data,
  onRowClick,
  getRowLabel,
  ariaLabel = 'Data table',
  selectedId,
}: {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: ((record: T) => void) | undefined;
  getRowLabel?: ((record: T) => string) | undefined;
  ariaLabel?: string | undefined;
  selectedId?: string | null | undefined;
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
                <th
                  key={column.key}
                  scope="col"
                  style={column.align ? { textAlign: column.align } : undefined}
                >
                  {column.label}
                </th>
              ))}
              {hasRowAction ? (
                <th scope="col" style={{ textAlign: 'right' }}>
                  Action
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.map((record, index) => {
              const isSelected = Boolean(
                selectedId && record.id === selectedId,
              );
              return (
                <tr
                  key={record.id ?? `record-${index}`}
                  className={isSelected ? 'table-row-selected' : undefined}
                  style={
                    isSelected
                      ? {
                          backgroundColor:
                            'var(--color-accent-subtle, #faebe4)',
                          outline: '1px solid var(--color-accent)',
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td
                      data-label={column.label}
                      key={column.key}
                      style={
                        column.align ? { textAlign: column.align } : undefined
                      }
                    >
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
                        Open <ArrowUpRight size={14} aria-hidden="true" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mobile-record-list">
        {data.map((record, index) => {
          const isSelected = Boolean(selectedId && record.id === selectedId);
          return (
            <article
              aria-label={onRowClick ? rowLabel(record, index) : undefined}
              className={`mobile-record-card${isSelected ? ' mobile-record-selected' : ''}`}
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
                  Open <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              ) : null}
            </article>
          );
        })}
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
        <CaretLeft size={16} />
      </button>
      <span className="mono">
        Page <strong>{page}</strong> of {totalPages}
      </span>
      <button
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        <CaretRight size={16} />
      </button>
    </nav>
  );
}
