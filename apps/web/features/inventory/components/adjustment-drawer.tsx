'use client';

import { InventoryAdjustmentInputSchema } from '@stockpilot/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
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
import { usePage } from '../../../hooks/use-page-query';
import { type ProductRecord } from '../../shared/types';

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
  const products = usePage<ProductRecord>('/products', {
    page: 1,
    pageSize: 100,
  });
  const form = useForm<z.infer<typeof InventoryAdjustmentInputSchema>>({
    resolver: zodResolver(InventoryAdjustmentInputSchema) as never,
    defaultValues: {
      productId: '',
      quantity: 1,
      reason: '',
      type: 'ADJUSTMENT_IN',
    },
  });
  const mutation = useMutation({
    mutationFn: createAdjustment,
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not adjust stock.',
        'error',
      ),
    onSuccess: onSaved,
  });
  const close = closeFormSafely(form.formState.isDirty, onClose);
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
        onSubmit={(event) =>
          void form.handleSubmit((value) => mutation.mutate(value))(event)
        }
      >
        <FormField
          error={form.formState.errors.productId?.message}
          htmlFor="adjust-product"
          label="Product"
        >
          <select id="adjust-product" {...form.register('productId')}>
            <option value="">Choose product</option>
            {products.data?.items.map((product) => (
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
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? 'Applying…' : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
