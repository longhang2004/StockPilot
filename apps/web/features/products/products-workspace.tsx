'use client';

import Image from 'next/image';
import type { Role } from '@stockpilot/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { useState } from 'react';

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
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import {
  createProduct,
  deleteProductImage,
  PRODUCTS_RESOURCE,
  updateProduct,
  uploadProductImage,
} from './api';
import { useToasts } from '../../hooks/use-toasts';
import {
  ProductDrawer,
  type ProductFormValue,
} from './components/product-drawer';
import { type ProductRecord } from '../shared/types';

class ProductImageSaveError extends Error {
  constructor(
    readonly product: ProductRecord,
    message: string,
  ) {
    super(message);
    this.name = 'ProductImageSaveError';
  }
}

export function ProductsWorkspace({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const products = usePage<ProductRecord>('/products', {
    page: 1,
    pageSize: 100,
    search,
  });
  const canWrite = role === 'MANAGER' || role === 'OWNER';
  const mutation = useMutation({
    mutationFn: async ({
      id,
      value,
      imageFile: pendingImage,
      removeImage: shouldRemoveImage,
    }: {
      id: string | undefined;
      value: ProductFormValue;
      imageFile: File | null;
      removeImage: boolean;
    }) => {
      const saved = id
        ? await updateProduct(id, value)
        : await createProduct(value);
      try {
        if (pendingImage) {
          return await uploadProductImage(saved.id, pendingImage);
        }
        if (shouldRemoveImage && saved.image) {
          await deleteProductImage(saved.id);
          return { ...saved, image: null };
        }
        return saved;
      } catch (error) {
        throw new ProductImageSaveError(
          saved,
          error instanceof Error
            ? error.message
            : 'The product was saved, but the image change could not be completed.',
        );
      }
    },
    onError: (error) => {
      if (error instanceof ProductImageSaveError) {
        setEditing(error.product);
        setFormOpen(true);
        setImageError(error.message);
        void invalidatePageQueries(queryClient, PRODUCTS_RESOURCE);
        push('Product saved, image not uploaded. You can retry.', 'error');
        return;
      }
      push(
        error instanceof Error ? error.message : 'Could not save product.',
        'error',
      );
    },
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      setImageFile(null);
      setRemoveImage(false);
      setImageError(null);
      void invalidatePageQueries(queryClient, PRODUCTS_RESOURCE);
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
                setImageFile(null);
                setRemoveImage(false);
                setImageError(null);
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
          ariaLabel="Products"
          columns={productColumns}
          data={products.data.items}
          getRowLabel={(record) => record.sku}
          onRowClick={
            canWrite
              ? (record) => {
                  setEditing(record);
                  setImageFile(null);
                  setRemoveImage(false);
                  setImageError(null);
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
                onClick={() => {
                  setEditing(null);
                  setImageFile(null);
                  setRemoveImage(false);
                  setImageError(null);
                  setFormOpen(true);
                }}
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
        imageError={imageError}
        imageFile={imageFile}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setImageFile(null);
          setRemoveImage(false);
          setImageError(null);
        }}
        onImageFileChange={(file) => {
          setImageFile(file);
          setImageError(null);
        }}
        onRemoveImage={() => {
          setRemoveImage((value) => !value);
          setImageError(null);
        }}
        onSave={(value) =>
          mutation.mutate({
            id: editing?.id,
            imageFile,
            removeImage,
            value,
          })
        }
        open={formOpen}
        pending={mutation.isPending}
        removeImage={removeImage}
      />
    </section>
  );
}

const productColumns: TableColumn<ProductRecord>[] = [
  {
    key: 'image',
    label: 'Image',
    render: (record) => (
      <span className="product-thumbnail-frame">
        {record.image ? (
          <Image
            alt={`${record.name} product image`}
            className="product-thumbnail"
            height={48}
            sizes="48px"
            src={record.image.url}
            width={48}
          />
        ) : (
          <span
            aria-label="No product image"
            className="product-thumbnail-placeholder"
          >
            —
          </span>
        )}
      </span>
    ),
  },
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
