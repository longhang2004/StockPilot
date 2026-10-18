'use client';

import { SalesOrderInputSchema } from '@stockpilot/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { Plus, Trash } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  Drawer,
  FormField,
  UnsavedChangesGuard,
  type ToastMessage,
} from '../../../components/ui/operations-ui';
import { ExpiredCommandResolution } from '../../shared/expired-command-resolution';
import { useCommandMutation } from '../../../hooks/use-command-mutation';
import { closeFormSafely, formatMoney } from '../../../lib/formatters';
import { ApiProblem } from '../../../lib/api-client';
import {
  CatalogSearchControls,
  useCatalogSearch,
} from '../../shared/catalog-search';
import { availableLineProducts } from '../../shared/line-selection';
import {
  createDraftOrder,
  fetchOrderCustomer,
  fetchOrderProduct,
  updateDraftOrder,
} from '../api';
import {
  type OrderDetail,
  type PartnerRecord,
  type ProductRecord,
} from '../../shared/types';

type OrderFormValues = z.infer<typeof SalesOrderInputSchema>;

const emptyOrder: OrderFormValues = {
  customerId: '',
  lines: [{ productId: '', quantity: 1 }],
  note: null,
};

function valuesFromOrder(order: OrderDetail): OrderFormValues {
  return {
    customerId: order.customerId,
    lines: order.lines.map(({ productId, quantity }) => ({
      productId,
      quantity,
    })),
    note: order.note,
  };
}

export function OrderFormDrawer({
  open,
  order,
  onClose,
  onSaved,
  onConflictRefresh,
  onRecoveryChange,
  push,
}: {
  open: boolean;
  order?: OrderDetail | undefined;
  onClose: () => void;
  onSaved: (order: OrderDetail) => void;
  onConflictRefresh?: (() => Promise<OrderDetail>) | undefined;
  onRecoveryChange?: ((pending: boolean) => void) | undefined;
  push: (message: string, tone?: ToastMessage['tone']) => void;
}) {
  const editing = Boolean(order);
  const customers = useCatalogSearch<PartnerRecord>('/customers');
  const products = useCatalogSearch<ProductRecord>('/products');
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(SalesOrderInputSchema) as never,
    defaultValues: emptyOrder,
  });
  const { append, fields, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });
  const lines = useWatch({ control: form.control, name: 'lines' }) ?? [];
  const command = useCommandMutation<OrderFormValues, OrderDetail>({
    prefix: 'order-draft-create',
    validate: (value): value is OrderFormValues =>
      SalesOrderInputSchema.safeParse(value).success,
    command: createDraftOrder,
    onError: (error) =>
      push(
        error instanceof Error
          ? error.message
          : 'Could not create the draft order.',
        'error',
      ),
    onSuccess: (created) => {
      form.reset(emptyOrder);
      onSaved(created);
    },
  });
  const [conflict, setConflict] = useState(false);
  const [latestOrder, setLatestOrder] = useState<OrderDetail | null>(null);
  const [checkingLatest, setCheckingLatest] = useState(false);

  const customerQuery = useQuery({
    queryKey: ['order-edit-customer', order?.customerId],
    queryFn: () => fetchOrderCustomer(order!.customerId),
    enabled: Boolean(open && order),
  });
  const productQueries = useQueries({
    queries: (order?.lines ?? []).map(({ productId }) => ({
      queryKey: ['order-edit-product', productId],
      queryFn: () => fetchOrderProduct(productId),
      enabled: Boolean(open && order),
    })),
  });
  const customerOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...customers.items,
            ...(customerQuery.data ? [customerQuery.data] : []),
          ].map((customer) => [customer.id, customer]),
        ).values(),
      ),
    [customerQuery.data, customers.items],
  );
  const productOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...products.items,
            ...productQueries.flatMap((query) =>
              query.data ? [query.data] : [],
            ),
          ].map((product) => [product.id, product]),
        ).values(),
      ),
    [productQueries, products.items],
  );
  const productById = new Map(
    productOptions.map((product) => [product.id, product]),
  );
  const editDataLoading = Boolean(
    editing &&
    (customerQuery.isLoading ||
      productQueries.some((query) => query.isLoading)),
  );
  const subtotal = lines.reduce((sum, line) => {
    const product = line?.productId
      ? productById.get(line.productId)
      : undefined;
    if (!product || !line?.quantity) return sum;
    return sum + Number(product.salePrice) * line.quantity;
  }, 0);
  const update = useMutation({
    mutationFn: (value: OrderFormValues) => updateDraftOrder(order!.id, value),
    onError: (error) => {
      if (error instanceof ApiProblem && error.problem.status === 409) {
        setConflict(true);
        setLatestOrder(null);
      }
      push(
        error instanceof Error
          ? error.message
          : 'Could not update the draft order.',
        'error',
      );
    },
    onSuccess: (saved) => {
      setConflict(false);
      setLatestOrder(null);
      onSaved(saved);
    },
  });
  const pending = update.isPending || command.isPending;
  const createLocked = !editing && command.outcomeUnknown;
  const restoreValue = command.variables ?? command.restoredValue;

  useEffect(() => {
    onRecoveryChange?.(command.outcomeUnknown);
  }, [command.outcomeUnknown, onRecoveryChange]);

  useEffect(() => {
    if (!open) return;
    form.reset(order ? valuesFromOrder(order) : (restoreValue ?? emptyOrder));
    setConflict(false);
    setLatestOrder(null);
  }, [form, open, order?.id, restoreValue]);

  const close = () => {
    if (pending) return;
    if (createLocked) {
      onClose();
      return;
    }
    closeFormSafely(form.formState.isDirty, () => {
      form.reset(emptyOrder);
      update.reset();
      setConflict(false);
      setLatestOrder(null);
      onClose();
    })();
  };

  async function reviewLatest() {
    if (!onConflictRefresh) return;
    setCheckingLatest(true);
    try {
      setLatestOrder(await onConflictRefresh());
    } catch (error) {
      push(
        error instanceof Error
          ? `Current order could not be refreshed: ${error.message}`
          : 'Current order could not be refreshed.',
        'error',
      );
    } finally {
      setCheckingLatest(false);
    }
  }

  return (
    <Drawer
      description={
        editing
          ? 'Update a Draft order. Confirmation reserves inventory.'
          : 'A Draft does not reserve stock until a Manager confirms it.'
      }
      onClose={close}
      open={open}
      size="wide"
      title={
        editing
          ? `Edit ${order?.orderNumber ?? 'Draft order'}`
          : 'New draft order'
      }
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty && !createLocked} />
      {conflict ? (
        <div className="work-panel order-edit-conflict" role="alert">
          <p>
            This order changed before your Draft could be saved. Your entered
            values are still here; review the latest server version before
            deciding what to keep.
          </p>
          <button
            className="button button-secondary"
            disabled={checkingLatest}
            onClick={() => void reviewLatest()}
            type="button"
          >
            {checkingLatest ? 'Checking…' : 'Review latest order'}
          </button>
          {latestOrder ? (
            <div className="order-conflict-latest">
              <strong>Current status: {latestOrder.status}</strong>
              <span>Updated {latestOrder.updatedAt}</span>
              <ul>
                {latestOrder.lines.map((line) => (
                  <li key={line.id}>
                    {line.skuSnapshot} · {line.quantity} units
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {!editing && command.outcomeUnknown ? (
        <div className="work-panel" role="alert">
          <p>{command.recoveryMessage}</p>
          {command.recoveryExpired ? (
            <ExpiredCommandResolution
              idempotencyKey={command.idempotencyKey}
              onResolve={command.resolveExpired}
            />
          ) : (
            <button
              className="button button-secondary"
              disabled={command.isPending}
              onClick={() => restoreValue && command.mutate(restoreValue)}
              type="button"
            >
              Retry saved Draft request
            </button>
          )}
        </div>
      ) : null}
      <form
        className="form-stack"
        onSubmit={(event) =>
          void form.handleSubmit((value) => {
            if (editing) update.mutate(value);
            else command.mutate(value);
          })(event)
        }
      >
        <fieldset
          className="form-stack form-fields"
          disabled={pending || createLocked || editDataLoading}
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
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
          </FormField>
          {editing && customerQuery.isError ? (
            <p className="form-error" role="alert">
              The saved customer could not be loaded. Retry the customer request
              before changing this order.
              <button
                className="button button-secondary"
                onClick={() => void customerQuery.refetch()}
                type="button"
              >
                Retry customer
              </button>
            </p>
          ) : null}
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
                productOptions,
                lines,
                index,
              );
              const selectedInactiveProduct =
                product && !product.isActive ? [product] : [];
              const choices = Array.from(
                new Map(
                  [...selectedInactiveProduct, ...availableProducts].map(
                    (candidate) => [candidate.id, candidate],
                  ),
                ).values(),
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
                          {choices.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.sku} · {candidate.name}
                              {!candidate.isActive ? ' (inactive)' : ''}
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
                    {editing && productQueries[index]?.isError ? (
                      <span className="form-error" role="alert">
                        Product details could not be loaded.{' '}
                        <button
                          className="button button-secondary"
                          onClick={() => void productQueries[index]?.refetch()}
                          type="button"
                        >
                          Retry product
                        </button>
                      </span>
                    ) : null}
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
                    {fields.length > 1 ? (
                      <button
                        aria-label={`Remove line ${index + 1}`}
                        className="button icon-button"
                        onClick={() => remove(index)}
                        type="button"
                      >
                        <Trash size={16} aria-hidden="true" />
                      </button>
                    ) : null}
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
            {form.formState.errors.lines?.root?.message ? (
              <p className="form-error">
                {form.formState.errors.lines.root.message}
              </p>
            ) : null}
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
            disabled={pending || createLocked}
            type="submit"
          >
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Save draft'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
