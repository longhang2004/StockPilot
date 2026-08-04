'use client';

import { SalesOrderInputSchema } from '@stockpilot/contracts';
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
import { apiRequest } from '../../../lib/api-client';
import { closeFormSafely } from '../../../lib/formatters';
import { usePage } from '../../../hooks/use-page-query';
import {
  type OrderDetail,
  type PartnerRecord,
  type ProductRecord,
} from '../../shared/types';

export function OrderFormDrawer({
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
  const customers = usePage<PartnerRecord>('/customers?page=1&pageSize=100');
  const products = usePage<ProductRecord>('/products?page=1&pageSize=100');
  const form = useForm<z.infer<typeof SalesOrderInputSchema>>({
    resolver: zodResolver(SalesOrderInputSchema) as never,
    defaultValues: {
      customerId: '',
      lines: [{ productId: '', quantity: 1 }],
      note: null,
    },
  });
  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof SalesOrderInputSchema>) =>
      apiRequest<OrderDetail>('/orders', {
        body: JSON.stringify(value),
        method: 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error
          ? error.message
          : 'Could not create the draft order.',
        'error',
      ),
    onSuccess: onSaved,
  });
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="A draft does not reserve stock until a Manager confirms it."
      onClose={close}
      open={open}
      title="New draft order"
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) =>
          void form.handleSubmit((value) => mutation.mutate(value))(event)
        }
      >
        <FormField
          error={form.formState.errors.customerId?.message}
          htmlFor="order-customer"
          label="Customer"
        >
          <select id="order-customer" {...form.register('customerId')}>
            <option value="">Choose customer</option>
            {customers.data?.items.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          error={form.formState.errors.lines?.[0]?.productId?.message}
          htmlFor="order-product"
          label="Product"
        >
          <select id="order-product" {...form.register('lines.0.productId')}>
            <option value="">Choose product</option>
            {products.data?.items
              .filter((product) => product.isActive)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
          </select>
        </FormField>
        <FormField
          error={form.formState.errors.lines?.[0]?.quantity?.message}
          htmlFor="order-quantity"
          label="Quantity"
        >
          <input
            id="order-quantity"
            min="1"
            type="number"
            {...form.register('lines.0.quantity', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          error={form.formState.errors.note?.message}
          htmlFor="order-note"
          label="Note"
        >
          <textarea id="order-note" {...form.register('note')} />
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
            {mutation.isPending ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
