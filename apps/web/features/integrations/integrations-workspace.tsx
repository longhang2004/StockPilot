'use client';

import { type Role } from '@stockpilot/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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
import { useWorkspaceLocation } from '../shared/use-workspace-location';

export function IntegrationsWorkspace({ role }: { role: Role }) {
  const { params, update, href } = useWorkspaceLocation();
  const selectedId = params.get('delivery');
  const [page, setPage] = useState(Number(params.get('page') || 1));
  const [search, setSearch] = useState(params.get('search') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const canRetry = role === 'MANAGER' || role === 'OWNER';
  const deliveries = usePage<IntegrationRecord>(
    '/integration-deliveries',
    {
      page,
      pageSize: 25,
      search,
      status,
    },
    { enabled: canRetry },
  );
  const detail = useQuery({
    queryKey: ['integration-delivery', selectedId],
    queryFn: () => fetchDelivery(selectedId!),
    enabled: Boolean(selectedId) && canRetry,
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
  useEffect(() => {
    setPage(Number(params.get('page') || 1));
    setSearch(params.get('search') || '');
    setStatus(params.get('status') || '');
  }, [params]);
  if (!canRetry)
    return (
      <section className="workspace-section-page">
        <PageHeader
          description="Delivery payloads and retry controls are available to managers and owners."
          title="Integrations"
        />
        <EmptyState
          description="Ask a manager or owner to inspect this delivery."
          title="Integration access required"
        />
      </section>
    );
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
          update({ search: value || null, page: null }, 'replace');
        }}
        placeholder="Search delivery ID or event"
        search={search}
      >
        <select
          aria-label="Filter deliveries by status"
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
            update(
              { status: event.target.value || null, page: null },
              'replace',
            );
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
          onRowClick={(record) => update({ delivery: record.id }, 'push')}
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
        onPageChange={(value) => {
          setPage(value);
          update({ page: value === 1 ? null : String(value) }, 'replace');
        }}
        page={page}
        totalPages={deliveries.data?.totalPages ?? 0}
      />
      <ToastRegion toasts={toasts} />
      <Drawer
        description={
          selected?.lastError ??
          'Inspect the delivery payload and processing state.'
        }
        onClose={() => update({ delivery: null }, 'push')}
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
            {selected.salesOrderId ? (
              <p className="muted-note">
                This delivery created a sales order in this workspace.{' '}
                <Link
                  className="text-link"
                  href={`/app/orders?order=${encodeURIComponent(selected.salesOrderId)}&returnTo=${encodeURIComponent(href())}`}
                >
                  Open order
                </Link>
              </p>
            ) : null}
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
