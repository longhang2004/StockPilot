'use client';

import { type Role } from '@stockpilot/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  Drawer,
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
  Skeleton,
  StatusBadge,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { apiRequest, newIdempotencyKey } from '../../lib/api-client';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { type IntegrationRecord } from '../shared/types';

export function IntegrationsWorkspace({ role }: { role: Role }) {
  const [selected, setSelected] = useState<IntegrationRecord | null>(null);
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const deliveries = usePage<IntegrationRecord>(
    '/integration-deliveries?page=1&pageSize=100',
  );
  const retry = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/integration-deliveries/${id}/retry`, {
        idempotencyKey: newIdempotencyKey('integration-retry'),
        method: 'POST',
      }),
    onError: (error) =>
      push(error instanceof Error ? error.message : 'Retry failed.', 'error'),
    onSuccess: () => {
      void invalidatePageQueries(queryClient, '/integration-deliveries');
      push('Delivery retry queued.', 'success');
    },
  });
  const canRetry = role === 'MANAGER' || role === 'OWNER';
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Review storefront deliveries, failed payloads, and safe manual retries."
        title="Integrations"
      />
      {deliveries.isLoading ? (
        <Skeleton lines={5} />
      ) : deliveries.isError ? (
        <ErrorState
          description="Integration deliveries could not be loaded."
          onRetry={() => void deliveries.refetch()}
        />
      ) : deliveries.data?.items.length ? (
        <ResponsiveDataTable
          columns={integrationColumns}
          data={deliveries.data.items}
          getRowLabel={(record) => record.externalDeliveryId}
          onRowClick={setSelected}
        />
      ) : (
        <EmptyState
          description="Webhook deliveries will appear here as storefront events arrive."
          title="No deliveries yet"
        />
      )}
      <ToastRegion toasts={toasts} />
      <Drawer
        description={
          selected?.lastError ??
          'Inspect the delivery payload and processing state.'
        }
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={selected?.externalDeliveryId ?? 'Delivery detail'}
      >
        {selected ? (
          <div className="detail-stack">
            <StatusBadge value={selected.status} />
            <dl className="detail-metadata">
              <div>
                <dt>Event</dt>
                <dd>{selected.eventType}</dd>
              </div>
              <div>
                <dt>Attempts</dt>
                <dd className="mono">{selected.attempts}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
            </dl>
            <pre className="payload-preview">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
            {canRetry && selected.status === 'FAILED' ? (
              <button
                className="button button-primary"
                disabled={retry.isPending}
                onClick={() => retry.mutate(selected.id)}
                type="button"
              >
                {retry.isPending ? 'Retrying…' : 'Retry delivery'}
              </button>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}

const integrationColumns: TableColumn<IntegrationRecord>[] = [
  {
    key: 'externalDeliveryId',
    label: 'Delivery',
    render: (record) => (
      <span className="mono">{record.externalDeliveryId}</span>
    ),
  },
  { key: 'eventType', label: 'Event' },
  {
    key: 'status',
    label: 'Status',
    render: (record) => <StatusBadge value={record.status} />,
  },
  {
    key: 'attempts',
    label: 'Attempts',
    render: (record) => <span className="mono">{record.attempts}</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (record) => formatDate(record.createdAt),
  },
];
