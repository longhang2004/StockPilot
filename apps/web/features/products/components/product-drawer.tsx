'use client';

import { ProductInputSchema } from '@stockpilot/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  Drawer,
  FormField,
  UnsavedChangesGuard,
} from '../../../components/ui/operations-ui';
import { closeFormSafely } from '../../../lib/formatters';
import { type ProductRecord } from '../../shared/types';

export function ProductDrawer({
  open,
  editing,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  editing: ProductRecord | null;
  onClose: () => void;
  onSave: (
    value: z.infer<typeof ProductInputSchema> & { isActive?: boolean },
  ) => void;
  pending: boolean;
}) {
  const form = useForm<
    z.infer<typeof ProductInputSchema> & { isActive?: boolean }
  >({
    resolver: zodResolver(ProductInputSchema) as never,
    defaultValues: {
      description: null,
      name: '',
      reorderPoint: 0,
      salePrice: '0.00',
      sku: '',
    },
  });
  useEffect(() => {
    form.reset(
      editing
        ? {
            description: null,
            isActive: editing.isActive,
            name: editing.name,
            reorderPoint: editing.reorderPoint,
            salePrice: editing.salePrice,
            sku: editing.sku,
          }
        : {
            description: null,
            name: '',
            reorderPoint: 0,
            salePrice: '0.00',
            sku: '',
          },
    );
  }, [editing, form]);
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="SKU stays unique inside the current organization."
      onClose={close}
      open={open}
      title={editing ? 'Edit product' : 'Add product'}
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) => void form.handleSubmit(onSave)(event)}
      >
        <div className="form-grid">
          <FormField
            error={form.formState.errors.sku?.message}
            htmlFor="product-sku"
            label="SKU"
          >
            <input id="product-sku" {...form.register('sku')} />
          </FormField>
          <FormField
            error={form.formState.errors.name?.message}
            htmlFor="product-name"
            label="Product name"
          >
            <input id="product-name" {...form.register('name')} />
          </FormField>
        </div>
        <div className="form-grid">
          <FormField
            error={form.formState.errors.salePrice?.message}
            htmlFor="product-price"
            label="Sale price"
          >
            <input
              id="product-price"
              placeholder="0.00"
              {...form.register('salePrice')}
            />
          </FormField>
          <FormField
            error={form.formState.errors.reorderPoint?.message}
            htmlFor="product-reorder"
            label="Reorder point"
          >
            <input
              id="product-reorder"
              min="0"
              type="number"
              {...form.register('reorderPoint', { valueAsNumber: true })}
            />
          </FormField>
        </div>
        <FormField
          error={form.formState.errors.description?.message}
          htmlFor="product-description"
          label="Description"
        >
          <textarea
            id="product-description"
            {...form.register('description')}
          />
        </FormField>
        {editing ? (
          <label className="checkbox-field">
            <input type="checkbox" {...form.register('isActive')} /> Active
            product
          </label>
        ) : null}
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
