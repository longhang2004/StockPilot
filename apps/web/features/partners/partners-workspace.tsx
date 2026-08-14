'use client';

import type { CustomerInputSchema, Role } from '@stockpilot/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import type { z } from 'zod';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
  Skeleton,
  StatusBadge,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { savePartner } from './api';
import { useToasts } from '../../hooks/use-toasts';
import { PartnerDrawer } from './components/partner-drawer';
import { type PartnerRecord } from '../shared/types';

export function PartnersWorkspace({ role }: { role: Role }) {
  const [kind, setKind] = useState<'customers' | 'suppliers'>('customers');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerRecord | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const partners = usePage<PartnerRecord>(`/${kind}`, {
    page: 1,
    pageSize: 100,
  });
  const canWrite = role === 'MANAGER' || role === 'OWNER';
  const mutation = useMutation({
    mutationFn: ({
      id,
      value,
    }: {
      id: string | undefined;
      value: z.infer<typeof CustomerInputSchema>;
    }) => savePartner(kind, id, value),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Could not save partner.',
        'error',
      ),
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      void invalidatePageQueries(queryClient, `/${kind}`);
      push('Partner saved.', 'success');
    },
  });
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Keep customer and supplier records active, searchable, and tenant-scoped."
        title="Partners"
        action={
          canWrite ? (
            <button
              className="button button-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              type="button"
            >
              <Plus size={17} /> Add partner
            </button>
          ) : undefined
        }
      />
      <div
        className="segmented-control"
        role="tablist"
        aria-label="Partner type"
      >
        <button
          aria-selected={kind === 'customers'}
          className={kind === 'customers' ? 'is-active' : undefined}
          onClick={() => setKind('customers')}
          role="tab"
          type="button"
        >
          Customers
        </button>
        <button
          aria-selected={kind === 'suppliers'}
          className={kind === 'suppliers' ? 'is-active' : undefined}
          onClick={() => setKind('suppliers')}
          role="tab"
          type="button"
        >
          Suppliers
        </button>
      </div>
      {partners.isLoading ? (
        <Skeleton lines={4} />
      ) : partners.isError ? (
        <ErrorState
          description="Partners could not be loaded."
          onRetry={() => void partners.refetch()}
        />
      ) : partners.data?.items.length ? (
        <ResponsiveDataTable
          columns={partnerColumns}
          data={partners.data.items}
          getRowLabel={(record) => record.companyName}
          onRowClick={
            canWrite
              ? (record) => {
                  setEditing(record);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <EmptyState
          description={`Create a ${kind === 'customers' ? 'customer' : 'supplier'} to use in operational forms.`}
          title={`No ${kind} yet`}
        />
      )}
      <ToastRegion toasts={toasts} />
      <PartnerDrawer
        editing={editing}
        kind={kind}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={(value) => mutation.mutate({ id: editing?.id, value })}
        open={formOpen}
        pending={mutation.isPending}
      />
    </section>
  );
}

const partnerColumns: TableColumn<PartnerRecord>[] = [
  {
    key: 'companyName',
    label: 'Company',
    render: (record) => <strong>{record.companyName}</strong>,
  },
  { key: 'contactName', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  {
    key: 'isActive',
    label: 'Lifecycle',
    render: (record) => (
      <StatusBadge value={record.isActive ? 'SUCCEEDED' : 'CANCELLED'} />
    ),
  },
];
