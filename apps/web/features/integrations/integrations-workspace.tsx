'use client';

import { type Role } from '@stockpilot/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  Drawer,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  ResponsiveDataTable,
  SearchFilterBar,
  Skeleton,
  StatusBadge,
  ToastRegion,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { DELIVERIES_RESOURCE, fetchDelivery, retryDelivery } from './api';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { invalidatePageQueries, usePage } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { useCommandMutation } from '../../hooks/use-command-mutation';
import { type IntegrationRecord } from '../shared/types';
import { ExpiredCommandResolution } from '../shared/expired-command-resolution';

export function IntegrationsWorkspace({ role }: { role: Role }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const deliveries = usePage<IntegrationRecord>('/integration-deliveries', {
    page,
    pageSize: 25,
    search,
    status,
  });
  const detail = useQuery({
    queryKey: ['integration-delivery', selectedId],
    queryFn: () => fetchDelivery(selectedId!),
    enabled: Boolean(selectedId),
  });
  const selected = detail.data;
  const retry = useCommandMutation({
    command: retryDelivery,
    prefix: 'integration-retry',
    validate: (value): value is string =>
      typeof value === 'string' && value.length > 0,
    onError: (error) =>
      push(error instanceof Error ? error.message : 'Retry failed.', 'error'),
    onSuccess: (result, id) => {
      void invalidatePageQueries(queryClient, DELIVERIES_RESOURCE);
      void queryClient.invalidateQueries({
        queryKey: ['integration-delivery', id],
      });
      if (result.status === 'SUCCEEDED') {
        push('Delivery processed successfully.', 'success');
      } else if (result.status === 'FAILED') {
        push(
          result.error ??
            'Delivery processing failed. Review the error before retrying.',
          'error',
        );
      } else {
        push(
          'Delivery is still being processed. Refresh to check its result.',
          'info',
        );
      }
    },
  });
  const canRetry = role === 'MANAGER' || role === 'OWNER';
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Review storefront deliveries, failed payloads, and safe manual retries."
        title="Integrations"
      />
      <SearchFilterBar
        onSearch={(value) => {
          setPage(1);
          setSearch(value);
        }}
        placeholder="Search delivery ID or event"
        search={search}
      >
        <select
          aria-label="Filter deliveries by status"
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          value={status}
        >
          <option value="">All statuses</option>
          <option value="RECEIVED">Received</option>
          <option value="PROCESSING">Processing</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="FAILED">Failed</option>
        </select>
      </SearchFilterBar>
      {deliveries.data ? (
        <p className="muted-note">
          {deliveries.data.total} deliveries match this view
        </p>
      ) : null}
      {retry.outcomeUnknown ? (
        <div className="work-panel" role="alert">
          <p>{retry.recoveryMessage}</p>
          {retry.recoveryExpired ? (
            <ExpiredCommandResolution
              idempotencyKey={retry.idempotencyKey}
              onResolve={retry.resolveExpired}
            />
          ) : (
            <button
              className="button button-secondary"
              disabled={retry.isPending}
              onClick={() => retry.variables && retry.mutate(retry.variables)}
              type="button"
            >
              Recover retry result
            </button>
          )}
        </div>
      ) : null}
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
          onRowClick={(record) => setSelectedId(record.id)}
          selectedId={selectedId}
        />
      ) : (
        <EmptyState
          description="Webhook deliveries will appear here as storefront events arrive."
          title={
            search || status
              ? 'No deliveries match this view'
              : 'No deliveries yet'
          }
        />
      )}
      <Pagination
        onPageChange={setPage}
        page={page}
        totalPages={deliveries.data?.totalPages ?? 0}
      />
      <ToastRegion toasts={toasts} />
      <Drawer
        description={
          selected?.lastError ??
          'Inspect the delivery payload and processing state.'
        }
        onClose={() => setSelectedId(null)}
        open={Boolean(selectedId)}
        title={selected?.externalDeliveryId ?? 'Delivery detail'}
      >
        {detail.isLoading ? (
          <Skeleton lines={4} />
        ) : detail.isError ? (
          <ErrorState
            description="Delivery details could not be loaded."
            onRetry={() => void detail.refetch()}
          />
        ) : selected ? (
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
                disabled={retry.locked}
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
    align: 'right',
    render: (record) => <span className="mono">{record.attempts}</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    align: 'right',
    render: (record) => formatDate(record.createdAt),
  },
];
