'use client';

import {
  CustomerInputSchema,
  SupplierInputSchema,
} from '@stockpilot/contracts';
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
import { type PartnerRecord } from '../../shared/types';

export function PartnerDrawer({
  open,
  editing,
  kind,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  editing: PartnerRecord | null;
  kind: 'customers' | 'suppliers';
  onClose: () => void;
  onSave: (value: z.infer<typeof CustomerInputSchema>) => void;
  pending: boolean;
}) {
  const form = useForm<z.infer<typeof CustomerInputSchema>>({
    resolver: zodResolver(
      kind === 'customers' ? CustomerInputSchema : SupplierInputSchema,
    ) as never,
    defaultValues: {
      companyName: '',
      contactName: null,
      email: null,
      phone: null,
    },
  });
  useEffect(() => {
    form.reset(
      editing
        ? {
            companyName: editing.companyName,
            contactName: editing.contactName,
            email: editing.email,
            phone: editing.phone,
          }
        : { companyName: '', contactName: null, email: null, phone: null },
    );
  }, [editing, form]);
  const close = closeFormSafely(form.formState.isDirty, onClose);
  return (
    <Drawer
      description="Inactive records remain available for historical references."
      onClose={close}
      open={open}
      title={`${editing ? 'Edit' : 'Add'} ${kind === 'customers' ? 'customer' : 'supplier'}`}
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        className="form-stack"
        onSubmit={(event) => void form.handleSubmit(onSave)(event)}
      >
        <FormField
          error={form.formState.errors.companyName?.message}
          htmlFor="partner-company"
          label="Company name"
        >
          <input id="partner-company" {...form.register('companyName')} />
        </FormField>
        <div className="form-grid">
          <FormField
            error={form.formState.errors.contactName?.message}
            htmlFor="partner-contact"
            label="Contact name"
          >
            <input id="partner-contact" {...form.register('contactName')} />
          </FormField>
          <FormField
            error={form.formState.errors.email?.message}
            htmlFor="partner-email"
            label="Email"
          >
            <input
              id="partner-email"
              type="email"
              {...form.register('email')}
            />
          </FormField>
        </div>
        <FormField
          error={form.formState.errors.phone?.message}
          htmlFor="partner-phone"
          label="Phone"
        >
          <input id="partner-phone" {...form.register('phone')} />
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
            disabled={pending}
            type="submit"
          >
            {pending ? 'Saving…' : 'Save partner'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
