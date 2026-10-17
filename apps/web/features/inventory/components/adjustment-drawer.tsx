'use client';

import { InventoryAdjustmentInputSchema } from '@stockpilot/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  Drawer,
  FormField,
  UnsavedChangesGuard,
  type ToastMessage,
} from '../../../components/ui/operations-ui';
import { createAdjustment } from '../api';
import { closeFormSafely } from '../../../lib/formatters';
import { useCommandMutation } from '../../../hooks/use-command-mutation';
import {
  CatalogSearchControls,
  useCatalogSearch,
} from '../../shared/catalog-search';
import { type ProductRecord } from '../../shared/types';
import { ExpiredCommandResolution } from '../../shared/expired-command-resolution';

export function AdjustmentDrawer({
  open,
  onClose,
  onSaved,
  push,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  push: (message: string, tone?: ToastMessage['tone']) => void;
}) {
  const products = useCatalogSearch<ProductRecord>('/products');
  const form = useForm<z.infer<typeof InventoryAdjustmentInputSchema>>({
    resolver: zodResolver(InventoryAdjustmentInputSchema) as never,
    defaultValues: {
      productId: '',
      quantity: 1,
      reason: '',
      type: 'ADJUSTMENT_IN',
    },
  });
  const mutation = useCommandMutation({
    command: createAdjustment,
    prefix: 'adjustment',
    validate: (
      value,
    ): value is z.infer<typeof InventoryAdjustmentInputSchema> =>
      InventoryAdjustmentInputSchema.safeParse(value).success,
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not adjust stock.',
        'error',
      ),
    onSuccess: () => {
      form.reset();
      onSaved();
    },
  });
  useEffect(() => {
    if (mutation.restoredValue) form.reset(mutation.restoredValue);
  }, [form, mutation.restoredValue]);
  const close = () => {
    if (mutation.isPending) return;
    if (mutation.outcomeUnknown) return onClose();
    closeFormSafely(form.formState.isDirty, () => {
      form.reset();
      mutation.reset();
      onClose();
    })();
  };
  return (
    <Drawer
      description="Adjustments create a compensating ledger movement; history is never edited."
      onClose={close}
      open={open}
      title="Adjust inventory"
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) => {
          if (mutation.outcomeUnknown && mutation.variables) {
            event.preventDefault();
            mutation.mutate(mutation.variables);
            return;
          }
          void form.handleSubmit((value) => mutation.mutate(value))(event);
        }}
      >
        {mutation.outcomeUnknown ? (
          <div className="form-error form-stack" role="alert">
            <p>{mutation.recoveryMessage}</p>
            {mutation.recoveryExpired ? (
              <ExpiredCommandResolution
                idempotencyKey={mutation.idempotencyKey}
                onResolve={mutation.resolveExpired}
              />
            ) : null}
          </div>
        ) : null}
        <fieldset className="form-stack form-fields" disabled={mutation.locked}>
          <CatalogSearchControls catalog={products} label="Search products" />
          <FormField
            error={form.formState.errors.productId?.message}
            htmlFor="adjust-product"
            label="Product"
          >
            <select
              id="adjust-product"
              {...form.register('productId', {
                onChange: (event) => products.remember(event.target.value),
              })}
            >
              <option value="">Choose product</option>
              {form.watch('productId') &&
              !products.items.some(
                (product) => product.id === form.watch('productId'),
              ) ? (
                <option value={form.watch('productId')}>
                  Saved product · {form.watch('productId')}
                </option>
              ) : null}
              {products.items.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="form-grid">
            <FormField
              error={form.formState.errors.type?.message}
              htmlFor="adjust-type"
              label="Direction"
            >
              <select id="adjust-type" {...form.register('type')}>
                <option value="ADJUSTMENT_IN">Add stock</option>
                <option value="ADJUSTMENT_OUT">Remove stock</option>
              </select>
            </FormField>
            <FormField
              error={form.formState.errors.quantity?.message}
              htmlFor="adjust-quantity"
              label="Quantity"
            >
              <input
                id="adjust-quantity"
                min="1"
                type="number"
                {...form.register('quantity', { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <FormField
            error={form.formState.errors.reason?.message}
            htmlFor="adjust-reason"
            label="Reason"
          >
            <textarea id="adjust-reason" {...form.register('reason')} />
          </FormField>
        </fieldset>
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            {mutation.outcomeUnknown ? 'Close and keep request' : 'Cancel'}
          </button>
          <button
            className="button button-primary"
            disabled={mutation.isPending || mutation.recoveryExpired}
            type="submit"
          >
            {mutation.isPending
              ? 'Applying…'
              : mutation.outcomeUnknown
                ? 'Retry same adjustment'
                : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
