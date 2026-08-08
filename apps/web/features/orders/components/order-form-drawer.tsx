'use client';

import { SalesOrderInputSchema } from '@stockpilot/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash } from '@phosphor-icons/react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  Drawer,
  FormField,
  UnsavedChangesGuard,
  type ToastMessage,
} from '../../../components/ui/operations-ui';
import { apiRequest } from '../../../lib/api-client';
import { closeFormSafely, formatMoney } from '../../../lib/formatters';
import { usePage } from '../../../hooks/use-page-query';
import {
  type OrderDetail,
  type PartnerRecord,
  type ProductRecord,
} from '../../shared/types';

type OrderFormValues = z.infer<typeof SalesOrderInputSchema>;

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
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(SalesOrderInputSchema) as never,
    defaultValues: {
      customerId: '',
      lines: [{ productId: '', quantity: 1 }],
      note: null,
    },
  });
  const { append, fields, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });
  const lines = useWatch({ control: form.control, name: 'lines' }) ?? [];
  const productById = new Map(
    (products.data?.items ?? []).map((product) => [product.id, product]),
  );
  const subtotal = lines.reduce((sum, line) => {
    const product = line?.productId
      ? productById.get(line.productId)
      : undefined;
    if (!product || !line?.quantity) return sum;
    return sum + Number(product.salePrice) * line.quantity;
  }, 0);
  const mutation = useMutation({
    mutationFn: (value: OrderFormValues) =>
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
      size="wide"
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
        <div className="line-editor" aria-label="Order lines">
          <div className="line-editor-header" aria-hidden="true">
            <span>Product</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span>Total</span>
            <span />
          </div>
          {fields.map((field, index) => {
            const line = lines[index];
            const product = line?.productId
              ? productById.get(line.productId)
              : undefined;
            const lineTotal = product
              ? Number(product.salePrice) * (line?.quantity ?? 0)
              : 0;
            const selectedElsewhere = (candidateId: string) =>
              lines.some(
                (candidate, otherIndex) =>
                  otherIndex !== index && candidate?.productId === candidateId,
              );
            const availableProducts =
              products.data?.items.filter(
                (candidate) =>
                  candidate.isActive && !selectedElsewhere(candidate.id),
              ) ?? [];
            return (
              <div className="line-editor-row" key={field.id}>
                <div className="line-editor-cell line-editor-product">
                  <Controller
                    control={form.control}
                    name={`lines.${index}.productId`}
                    render={({ field: productField }) => (
                      <select
                        aria-label={`Product for line ${index + 1}`}
                        {...productField}
                      >
                        <option value="">Choose product</option>
                        {availableProducts.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.sku} · {candidate.name}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  {form.formState.errors.lines?.[index]?.productId?.message && (
                    <span className="form-error">
                      {form.formState.errors.lines?.[index]?.productId?.message}
                    </span>
                  )}
                </div>
                <div className="line-editor-cell line-editor-qty">
                  <Controller
                    control={form.control}
                    name={`lines.${index}.quantity`}
                    render={({ field: quantityField }) => (
                      <input
                        aria-label={`Quantity for line ${index + 1}`}
                        min="1"
                        type="number"
                        {...quantityField}
                        onChange={(event) =>
                          quantityField.onChange(
                            event.target.value === ''
                              ? 1
                              : Number(event.target.value),
                          )
                        }
                      />
                    )}
                  />
                  {form.formState.errors.lines?.[index]?.quantity?.message && (
                    <span className="form-error">
                      {form.formState.errors.lines?.[index]?.quantity?.message}
                    </span>
                  )}
                </div>
                <div className="line-editor-cell line-editor-price">
                  {product ? formatMoney(product.salePrice) : '—'}
                </div>
                <div className="line-editor-cell line-editor-total mono">
                  {formatMoney(lineTotal)}
                </div>
                <div className="line-editor-cell line-editor-remove">
                  {fields.length > 1 && (
                    <button
                      aria-label={`Remove line ${index + 1}`}
                      className="button icon-button"
                      onClick={() => remove(index)}
                      type="button"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <button
            className="line-editor-add"
            onClick={() => append({ productId: '', quantity: 1 })}
            type="button"
          >
            <Plus size={16} aria-hidden="true" /> Add line
          </button>
          {form.formState.errors.lines?.root?.message && (
            <p className="form-error">
              {form.formState.errors.lines.root.message}
            </p>
          )}
          <div className="line-editor-subtotal">
            <span>Subtotal</span>
            <strong className="mono">{formatMoney(subtotal)}</strong>
          </div>
        </div>
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
