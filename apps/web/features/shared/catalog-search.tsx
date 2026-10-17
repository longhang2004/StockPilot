'use client';

import { useState } from 'react';

import { Pagination } from '../../components/ui/operations-ui';
import { usePage } from '../../hooks/use-page-query';

/** Bounded server search; retain selected records when moving between pages. */
export function useCatalogSearch<T extends { id: string }>(resource: string) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<T[]>([]);
  const query = usePage<T>(resource, { page, pageSize: 25, search });
  const items = Array.from(
    new Map(
      [...chosen, ...(query.data?.items ?? [])].map((item) => [item.id, item]),
    ).values(),
  );
  return {
    query,
    items,
    page,
    search,
    setPage,
    setSearch: (value: string) => {
      setPage(1);
      setSearch(value);
    },
    remember: (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item)
        setChosen((previous) => [
          ...previous.filter((value) => value.id !== id),
          item,
        ]);
    },
  };
}

export function CatalogSearchControls({
  label,
  catalog,
}: {
  label: string;
  catalog: ReturnType<typeof useCatalogSearch>;
}) {
  return (
    <div className="catalog-search-controls">
      <label className="form-field">
        <span>{label}</span>
        <input
          aria-label={label}
          onChange={(event) => catalog.setSearch(event.target.value)}
          placeholder="Search all active records"
          type="search"
          value={catalog.search}
        />
      </label>
      <span className="muted-note" role="status">
        {catalog.query.isFetching
          ? 'Loading matches…'
          : catalog.query.isError
            ? 'Search could not be loaded.'
            : `${catalog.query.data?.total ?? 0} matches`}
      </span>
      {catalog.query.isError ? (
        <button
          className="button button-secondary"
          onClick={() => void catalog.query.refetch()}
          type="button"
        >
          Retry search
        </button>
      ) : null}
      <Pagination
        onPageChange={catalog.setPage}
        page={catalog.page}
        totalPages={catalog.query.data?.totalPages ?? 0}
      />
    </div>
  );
}
