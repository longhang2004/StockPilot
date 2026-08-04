'use client';

import type { ProductInputSchema, Role } from '@stockpilot/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import type { z } from 'zod';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
  SearchFilterBar,
  Skeleton,
  StatusBadge,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { apiRequest } from '../../lib/api-client';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { ProductDrawer } from './components/product-drawer';
import { type ProductRecord } from '../shared/types';

export function ProductsWorkspace({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const products = usePage<ProductRecord>(
    `/products?page=1&pageSize=100&search=${encodeURIComponent(search)}`,
  );
  const canWrite = role === 'MANAGER' || role === 'OWNER';
  const mutation = useMutation({
    mutationFn: ({
      id,
      value,
    }: {
      id: string | undefined;
      value: z.infer<typeof ProductInputSchema> & { isActive?: boolean };
    }) =>
      apiRequest(id ? `/products/${id}` : '/products', {
        body: JSON.stringify(value),
        method: id ? 'PATCH' : 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not save product.',
        'error',
      ),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      void invalidatePageQueries(queryClient, '/products');
      push('Product saved.', 'success');
    },
  });
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Maintain SKU, pricing, and reorder points without deleting referenced history."
        title="Products"
        action={
          canWrite ? (
            <button
              className="button button-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              type="button"
            >
              <Plus size={17} /> Add product
            </button>
          ) : undefined
        }
      />
      <SearchFilterBar onSearch={setSearch} search={search} />
      {products.isLoading ? (
        <Skeleton lines={5} />
      ) : products.isError ? (
        <ErrorState
          description="Products could not be loaded."
          onRetry={() => void products.refetch()}
        />
      ) : products.data?.items.length ? (
        <ResponsiveDataTable
          columns={productColumns}
          data={products.data.items}
          getRowLabel={(record) => record.sku}
          onRowClick={
            canWrite
              ? (record) => {
                  setEditing(record);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <EmptyState
          description="Create the first product or import a catalog CSV."
          title="No products yet"
          action={
            canWrite ? (
              <button
                className="button button-primary"
                onClick={() => setFormOpen(true)}
                type="button"
              >
                Add product
              </button>
            ) : undefined
          }
        />
      )}
      <ToastRegion toasts={toasts} />
      <ProductDrawer
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={(value) => mutation.mutate({ id: editing?.id, value })}
        open={formOpen}
        pending={mutation.isPending}
      />
    </section>
  );
}

const productColumns: TableColumn<ProductRecord>[] = [
  {
    key: 'sku',
    label: 'SKU',
    render: (record) => <span className="mono">{record.sku}</span>,
  },
  {
    key: 'name',
    label: 'Product',
    render: (record) => <strong>{record.name}</strong>,
  },
  {
    key: 'salePrice',
    label: 'Sale price',
    render: (record) => <span className="mono">${record.salePrice}</span>,
  },
  {
    key: 'reorderPoint',
    label: 'Reorder point',
    render: (record) => <span className="mono">{record.reorderPoint}</span>,
  },
  {
    key: 'isActive',
    label: 'Lifecycle',
    render: (record) => (
      <StatusBadge value={record.isActive ? 'SUCCEEDED' : 'CANCELLED'} />
    ),
  },
];
