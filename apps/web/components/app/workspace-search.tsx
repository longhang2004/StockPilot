'use client';

import { MagnifyingGlass, ArrowUpRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePage } from '../../hooks/use-page-query';
import type {
  OrderRecord,
  ProductRecord,
  PartnerRecord,
} from '../../features/shared/types';
import { Drawer } from '../ui/overlays';

export function WorkspaceSearch() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const enabled = open && search.length >= 2;
  const params = { search, pageSize: 5, page: 1 };
  const orders = usePage<OrderRecord>('/orders', params, { enabled });
  const products = usePage<ProductRecord>('/products', params, { enabled });
  const partners = usePage<PartnerRecord>('/customers', params, { enabled });
  const groups = [
    {
      title: 'Orders',
      query: orders,
      items:
        orders.data?.items.map((item) => ({
          id: item.id,
          title: item.orderNumber,
          detail: item.customerCompanyName,
          href: `/app/orders?order=${encodeURIComponent(item.id)}`,
        })) ?? [],
    },
    {
      title: 'Products & stock',
      query: products,
      items:
        products.data?.items.map((item) => ({
          id: item.id,
          title: item.name,
          detail: item.sku,
          href: `/app/inventory?product=${encodeURIComponent(item.id)}`,
        })) ?? [],
    },
    {
      title: 'Customers',
      query: partners,
      items:
        partners.data?.items.map((item) => ({
          id: item.id,
          title: item.companyName,
          detail: item.contactName ?? 'Customer record',
          href: `/app/partners?search=${encodeURIComponent(item.companyName)}`,
        })) ?? [],
    },
  ];
  const current = enabled && input.trim() === search;
  const loading = !current || groups.some(({ query }) => query.isFetching);
  const hasResults = groups.some(({ items }) => items.length > 0);
  return (
    <>
      <button
        className="workspace-search-trigger"
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Search workspace… ⌘ / Ctrl K"
        aria-keyshortcuts="Control+k Meta+k"
      >
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span>Search workspace…</span>
        <kbd>⌘ / Ctrl K</kbd>
      </button>
      <Drawer
        open={open}
        title="Search workspace"
        description="Find an order, customer, product or SKU."
        onClose={() => setOpen(false)}
      >
        <label className="workspace-search-field">
          <MagnifyingGlass size={20} aria-hidden="true" />
          <span className="sr-only">Search workspace records</span>
          <input
            data-autofocus
            type="search"
            placeholder="Order number, customer or SKU…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || loading) return;
              event.preventDefault();
              event.currentTarget
                .closest('.drawer-body')
                ?.querySelector<HTMLAnchorElement>('.workspace-search-result')
                ?.click();
            }}
          />
        </label>
        <div role="status" className="muted-note">
          {input.trim().length < 2
            ? 'Type at least two characters.'
            : loading
              ? 'Searching workspace…'
              : !hasResults
                ? 'No matching records.'
                : 'Select a result, or press Enter to open the first.'}
        </div>
        {current
          ? groups.map(({ title, query, items }) => (
              <section
                className="workspace-search-group"
                key={title}
                aria-label={title}
              >
                <h3>{title}</h3>
                {query.isError ? (
                  <div className="search-error">
                    {title} could not be loaded.{' '}
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => void query.refetch()}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  items.map((item) => (
                    <Link
                      className="workspace-search-result"
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        setOpen(false);
                        setInput('');
                      }}
                    >
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </Link>
                  ))
                )}
              </section>
            ))
          : null}
      </Drawer>
    </>
  );
}
