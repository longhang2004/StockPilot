'use client';

import { ReceiptInputSchema } from '@stockpilot/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  PageHeader,
  ResponsiveDataTable,
  Skeleton,
  StatusBadge,
  ToastRegion,
  UnsavedChangesGuard,
  type TableColumn,
  type ToastMessage,
} from '../../components/ui/operations-ui';
import { apiRequest, newIdempotencyKey } from '../../lib/api-client';
import {
  closeFormSafely,
  formatDateTime,
  formatMoney,
} from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import {
  type MovementRecord,
  type PartnerRecord,
  type ProductRecord,
} from '../shared/types';

export function ReceiptsWorkspace() {
  const [open, setOpen] = useState(false);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const movements = usePage<MovementRecord>(
    '/inventory/movements?page=1&pageSize=100',
  );
  const receipts = (movements.data?.items ?? []).filter(
    (movement) => movement.type === 'RECEIPT',
  );
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Apply a goods receipt atomically and see the resulting ledger movement."
        title="Goods receipts"
        action={
          <button
            className="button button-primary"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Plus size={17} /> Receive stock
          </button>
        }
      />
      {movements.isLoading ? (
        <Skeleton lines={4} />
      ) : movements.isError ? (
        <ErrorState
          description="Receipt history could not be loaded."
          onRetry={() => void movements.refetch()}
        />
      ) : receipts.length ? (
        <ResponsiveDataTable
          ariaLabel="Receipt movements"
          columns={movementColumns}
          data={receipts}
          getRowLabel={(record) => record.product?.sku ?? record.id}
        />
      ) : (
        <EmptyState
          description="Create a receipt to increase on-hand stock and resolve low-stock alerts."
          title="No receipts yet"
          action={
            <button
              className="button button-primary"
              onClick={() => setOpen(true)}
              type="button"
            >
              Receive stock
            </button>
          }
        />
      )}
      <ToastRegion toasts={toasts} />
      <ReceiptDrawer
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          void invalidatePageQueries(queryClient, '/inventory/movements');
          push('Receipt applied to the ledger.', 'success');
        }}
        push={push}
      />
    </section>
  );
}

const movementColumns: TableColumn<MovementRecord>[] = [
  {
    key: 'type',
    label: 'Movement',
    render: (record) => <StatusBadge value={record.type} />,
  },
  {
    key: 'product',
    label: 'Product',
    render: (record) => (
      <span>
        {record.product?.name ?? '—'}
        <small className="muted-note mono">{record.product?.sku}</small>
      </span>
    ),
  },
  {
    key: 'quantityDelta',
    label: 'Quantity',
    render: (record) => <span className="mono">+{record.quantityDelta}</span>,
  },
  {
    key: 'createdAt',
    label: 'When',
    render: (record) => formatDateTime(record.createdAt),
  },
];

function ReceiptDrawer({
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
  const products = usePage<ProductRecord>('/products?page=1&pageSize=100');
  const suppliers = usePage<PartnerRecord>('/suppliers?page=1&pageSize=100');
  const form = useForm<z.infer<typeof ReceiptInputSchema>>({
    resolver: zodResolver(ReceiptInputSchema) as never,
    defaultValues: {
      lines: [{ productId: '', quantity: 1, unitCost: null }],
      note: null,
      receiptNumber: `WEB-${Date.now()}`,
      receivedAt: new Date().toISOString(),
      supplierId: '',
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
  const totalCost = lines.reduce((sum, line) => {
    const product = line?.productId
      ? productById.get(line.productId)
      : undefined;
    if (!product || !line?.quantity || !line?.unitCost) return sum;
    return sum + line.quantity * Number(line.unitCost);
  }, 0);
  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof ReceiptInputSchema>) =>
      apiRequest('/receipts', {
        body: JSON.stringify(value),
        idempotencyKey: newIdempotencyKey('receipt'),
        method: 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not apply the receipt.',
        'error',
      ),
    onSuccess: onSaved,
  });
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="Receipt, ledger movement, balance update, and alert reconciliation commit together."
      onClose={close}
      open={open}
      size="wide"
      title="Receive stock"
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) =>
          void form.handleSubmit((value) => mutation.mutate(value))(event)
        }
      >
        <div className="form-grid">
          <FormField
            error={form.formState.errors.receiptNumber?.message}
            htmlFor="receipt-number"
            label="Receipt number"
          >
            <input id="receipt-number" {...form.register('receiptNumber')} />
          </FormField>
          <FormField
            error={form.formState.errors.supplierId?.message}
            htmlFor="receipt-supplier"
            label="Supplier"
          >
            <select id="receipt-supplier" {...form.register('supplierId')}>
              <option value="">Choose supplier</option>
              {suppliers.data?.items
                .filter((supplier) => supplier.isActive)
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.companyName}
                  </option>
                ))}
            </select>
          </FormField>
        </div>
        <div className="line-editor" aria-label="Receipt lines">
          <div className="line-editor-header" aria-hidden="true">
            <span>Product</span>
            <span>Qty</span>
            <span>Unit cost</span>
            <span>Total</span>
            <span />
          </div>
          {fields.map((field, index) => {
            const line = lines[index];
            const product = line?.productId
              ? productById.get(line.productId)
              : undefined;
            const lineTotal =
              product && line?.quantity && line?.unitCost
                ? line.quantity * Number(line.unitCost)
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
                <div className="line-editor-cell line-editor-qty">
                  <Controller
                    control={form.control}
                    name={`lines.${index}.unitCost`}
                    render={({ field: costField }) => (
                      <input
                        aria-label={`Unit cost for line ${index + 1}`}
                        placeholder="0.00"
                        {...costField}
                        value={costField.value ?? ''}
                        onChange={(event) =>
                          costField.onChange(
                            event.target.value === ''
                              ? null
                              : event.target.value,
                          )
                        }
                      />
                    )}
                  />
                  {form.formState.errors.lines?.[index]?.unitCost?.message && (
                    <span className="form-error">
                      {form.formState.errors.lines?.[index]?.unitCost?.message}
                    </span>
                  )}
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
            onClick={() =>
              append({ productId: '', quantity: 1, unitCost: null })
            }
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
            <span>Total cost</span>
            <strong className="mono">{formatMoney(totalCost)}</strong>
          </div>
        </div>
        <FormField
          error={form.formState.errors.note?.message}
          htmlFor="receipt-note"
          label="Note"
        >
          <textarea id="receipt-note" {...form.register('note')} />
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
            {mutation.isPending ? 'Applying…' : 'Apply receipt'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
