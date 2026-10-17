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
import { closeFormSafely, formatMoney } from '../../../lib/formatters';
import {
  CatalogSearchControls,
  useCatalogSearch,
} from '../../shared/catalog-search';
import { availableLineProducts } from '../../shared/line-selection';
import { createDraftOrder } from '../api';
import { type PartnerRecord, type ProductRecord } from '../../shared/types';

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
  const customers = useCatalogSearch<PartnerRecord>('/customers');
  const products = useCatalogSearch<ProductRecord>('/products');
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
    products.items.map((product) => [product.id, product]),
  );
  const subtotal = lines.reduce((sum, line) => {
    const product = line?.productId
      ? productById.get(line.productId)
      : undefined;
    if (!product || !line?.quantity) return sum;
    return sum + Number(product.salePrice) * line.quantity;
  }, 0);
  const mutation = useMutation({
    mutationFn: createDraftOrder,
    onError: (error) =>
      push(
        error instanceof Error
          ? error.message
          : 'Could not create the draft order.',
        'error',
      ),
    onSuccess: () => {
      form.reset();
      onSaved();
    },
  });
  const close = () => {
    if (mutation.isPending) return;
    closeFormSafely(form.formState.isDirty, () => {
      form.reset();
      mutation.reset();
      onClose();
    })();
  };
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
        <fieldset
          className="form-stack form-fields"
          disabled={mutation.isPending}
        >
          <CatalogSearchControls catalog={customers} label="Search customers" />
          <FormField
            error={form.formState.errors.customerId?.message}
            htmlFor="order-customer"
            label="Customer"
          >
            <select
              id="order-customer"
              {...form.register('customerId', {
                onChange: (event) => customers.remember(event.target.value),
              })}
            >
              <option value="">Choose customer</option>
              {customers.items.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
          </FormField>
          <CatalogSearchControls catalog={products} label="Search products" />
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
              const availableProducts = availableLineProducts(
                products.items,
                lines,
                index,
              );
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
                          onChange={(event) => {
                            products.remember(event.target.value);
                            productField.onChange(event);
                          }}
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
                    {form.formState.errors.lines?.[index]?.productId
                      ?.message && (
                      <span className="form-error">
                        {
                          form.formState.errors.lines?.[index]?.productId
                            ?.message
                        }
                      </span>
                    )}
                  </div>
                  <div className="line-editor-cell line-editor-qty">
                    <span className="line-field-label" aria-hidden="true">
                      Quantity
                    </span>
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
                    {form.formState.errors.lines?.[index]?.quantity
                      ?.message && (
                      <span className="form-error">
                        {
                          form.formState.errors.lines?.[index]?.quantity
                            ?.message
                        }
                      </span>
                    )}
                  </div>
                  <div className="line-editor-cell line-editor-price">
                    <span className="line-field-label" aria-hidden="true">
                      Unit price
                    </span>
                    {product ? formatMoney(product.salePrice) : '—'}
                  </div>
                  <div className="line-editor-cell line-editor-total mono">
                    <span className="line-field-label" aria-hidden="true">
                      Total
                    </span>
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
        </fieldset>
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
