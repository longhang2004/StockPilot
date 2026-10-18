'use client';

import type {
  IntegrationDeliveryRecord,
  LowStockAlert,
  Role,
  SalesOrder,
} from '@stockpilot/contracts';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import Link from 'next/link';

import {
  ErrorState,
  EmptyState,
  Pagination,
  Skeleton,
  StatusBadge,
} from '../../components/ui/operations-ui';
import { formatDateTime } from '../../lib/formatters';
import type { PageResponse } from '../../lib/api-client';
import { fetchOverviewPage } from './api';

const PAGE_SIZE = 5;

export function ExceptionsWorklist({ role }: { role: Role }) {
  const [draftPage, setDraftPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);
  const [deliveryPage, setDeliveryPage] = useState(1);

  const drafts = useOverviewList<SalesOrder>('/orders', {
    page: draftPage,
    pageSize: PAGE_SIZE,
    status: 'DRAFT',
  });
  const alerts = useOverviewList<LowStockAlert>('/alerts', {
    page: alertPage,
    pageSize: PAGE_SIZE,
    status: 'OPEN',
  });
  const deliveries = useOverviewList<IntegrationDeliveryRecord>(
    '/integration-deliveries',
    { page: deliveryPage, pageSize: PAGE_SIZE, status: 'FAILED' },
    role !== 'STAFF',
  );

  return (
    <section
      className="overview-worklist"
      aria-labelledby="overview-worklist-title"
    >
      <header className="overview-worklist-heading">
        <div>
          <h2 id="overview-worklist-title">Worklist</h2>
          <p>
            Review draft orders, low-stock alerts, and failed deliveries that
            need attention.
          </p>
        </div>
      </header>

      <div className="overview-worklist-sections">
        <WorklistSection
          countLabel={(total) => `${total} draft${total === 1 ? '' : 's'}`}
          emptyDescription="There are no draft orders waiting for review."
          emptyTitle="No draft orders"
          heading="Draft orders"
          hrefAll="/app/orders?status=DRAFT"
          isError={drafts.isError}
          isLoading={drafts.isLoading}
          isRefreshing={drafts.isRefetching}
          onPageChange={setDraftPage}
          page={draftPage}
          pageData={drafts.data}
          refetch={() => void drafts.refetch()}
          viewAllLabel="View drafts"
        >
          {(drafts.data?.items ?? []).map((order) => {
            const href = `/app/orders?status=DRAFT&order=${encodeURIComponent(order.id)}`;
            return (
              <li className="overview-worklist-row" key={order.id}>
                <div className="overview-worklist-primary">
                  <Link className="overview-worklist-identity" href={href}>
                    {order.orderNumber}
                  </Link>
                  <span>{order.customerCompanyName}</span>
                  <small>
                    Draft awaiting review · created{' '}
                    <time dateTime={order.createdAt}>
                      {formatDateTime(order.createdAt)}
                    </time>
                  </small>
                </div>
                <StatusBadge value={order.status} />
                <Link className="overview-worklist-action" href={href}>
                  {role === 'STAFF' ? 'Edit draft' : 'Review draft'}
                </Link>
              </li>
            );
          })}
        </WorklistSection>

        <WorklistSection
          countLabel={(total) => `${total} open alert${total === 1 ? '' : 's'}`}
          emptyDescription="No open reorder alerts are reported."
          emptyTitle="No open alerts"
          heading="Low-stock alerts"
          hrefAll="/app/inventory"
          isError={alerts.isError}
          isLoading={alerts.isLoading}
          isRefreshing={alerts.isRefetching}
          onPageChange={setAlertPage}
          page={alertPage}
          pageData={alerts.data}
          refetch={() => void alerts.refetch()}
          viewAllLabel="View inventory"
        >
          {(alerts.data?.items ?? []).map((alert) => {
            const href = `/app/inventory?product=${encodeURIComponent(alert.productId)}`;
            return (
              <li className="overview-worklist-row" key={alert.id}>
                <div className="overview-worklist-primary">
                  <Link className="overview-worklist-identity" href={href}>
                    {alert.product.name}
                  </Link>
                  <span className="mono">{alert.product.sku}</span>
                  <small>
                    Available when opened: {alert.availableAtOpen} · reorder
                    point: {alert.reorderPoint} · alert opened{' '}
                    <time dateTime={alert.openedAt}>
                      {formatDateTime(alert.openedAt)}
                    </time>
                  </small>
                </div>
                <StatusBadge value={alert.status} />
                <Link className="overview-worklist-action" href={href}>
                  View stock
                </Link>
              </li>
            );
          })}
        </WorklistSection>

        <WorklistSection
          countLabel={(total) =>
            `${total} failed ${total === 1 ? 'delivery' : 'deliveries'}`
          }
          emptyDescription="No failed integration deliveries need review."
          emptyTitle="No failed deliveries"
          heading="Failed deliveries"
          hrefAll="/app/integrations?status=FAILED"
          isError={deliveries.isError}
          isLoading={deliveries.isLoading}
          isRefreshing={deliveries.isRefetching}
          onPageChange={setDeliveryPage}
          page={deliveryPage}
          pageData={deliveries.data}
          restricted={role === 'STAFF'}
          refetch={() => void deliveries.refetch()}
          viewAllLabel="View integrations"
        >
          {(deliveries.data?.items ?? []).map((delivery) => {
            const href = `/app/integrations?status=FAILED&delivery=${encodeURIComponent(delivery.id)}`;
            return (
              <li className="overview-worklist-row" key={delivery.id}>
                <div className="overview-worklist-primary">
                  <Link className="overview-worklist-identity" href={href}>
                    Delivery {delivery.externalDeliveryId}
                  </Link>
                  <span>{delivery.eventType}</span>
                  <small>
                    {delivery.lastError || 'Failure detail was not provided.'} ·
                    received{' '}
                    <time dateTime={delivery.createdAt}>
                      {formatDateTime(delivery.createdAt)}
                    </time>
                  </small>
                </div>
                <StatusBadge value={delivery.status} />
                <Link className="overview-worklist-action" href={href}>
                  Inspect delivery
                </Link>
              </li>
            );
          })}
        </WorklistSection>
      </div>
    </section>
  );
}

function useOverviewList<T>(
  resource: string,
  params: Record<string, string | number>,
  enabled = true,
) {
  return useQuery<PageResponse<T>>({
    queryKey: ['page', resource, params],
    queryFn: () => fetchOverviewPage<T>(resource, params),
    enabled,
    refetchOnMount: 'always',
    retry: false,
  });
}

function WorklistSection({
  children,
  countLabel,
  emptyDescription,
  emptyTitle,
  heading,
  hrefAll,
  isError,
  isLoading,
  isRefreshing,
  onPageChange,
  page,
  pageData,
  restricted = false,
  refetch,
  viewAllLabel,
}: {
  children: ReactNode;
  countLabel: (total: number) => string;
  emptyDescription: string;
  emptyTitle: string;
  heading: string;
  hrefAll: string;
  isError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageData: PageResponse<unknown> | undefined;
  restricted?: boolean;
  refetch: () => void;
  viewAllLabel: string;
}) {
  return (
    <section className="overview-worklist-section" aria-label={heading}>
      <header className="overview-worklist-section-header">
        <h3>{heading}</h3>
        {pageData && !isRefreshing && !isError ? (
          <span>{countLabel(pageData.total)}</span>
        ) : null}
        <Link href={hrefAll}>{viewAllLabel}</Link>
      </header>
      {restricted ? (
        <p className="overview-worklist-restricted">
          Delivery review is available to Managers and Owners.
        </p>
      ) : isLoading || isRefreshing ? (
        <Skeleton lines={3} />
      ) : isError ? (
        <ErrorState
          description={`${heading} could not be loaded. Its item count is unavailable.`}
          onRetry={refetch}
        />
      ) : pageData?.total === 0 ? (
        <EmptyState description={emptyDescription} title={emptyTitle} />
      ) : (
        <>
          <ul className="overview-worklist-list">{children}</ul>
          {pageData ? (
            <div className="overview-worklist-pagination">
              <span>
                Showing {pageData.items.length} of {pageData.total}
              </span>
              <Pagination
                onPageChange={onPageChange}
                page={page}
                totalPages={pageData.totalPages}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
