'use client';

import { Funnel, MagnifyingGlass } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

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
