'use client';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  ResponsiveDataTable,
  Skeleton,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { formatDateTime } from '../../lib/formatters';
import { usePage } from '../../hooks/use-page-query';
import { type AuditRecord } from '../shared/types';

export function AuditWorkspace() {
  const audit = usePage<AuditRecord>('/audit-events?page=1&pageSize=100');
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Trace actor, action, entity, and time behind every operational change."
        title="Audit trail"
      />
      {audit.isLoading ? (
        <Skeleton lines={5} />
      ) : audit.isError ? (
        <ErrorState
          description="Audit events could not be loaded."
          onRetry={() => void audit.refetch()}
        />
      ) : audit.data?.items.length ? (
        <ResponsiveDataTable
          columns={auditColumns}
          data={audit.data.items}
          getRowLabel={(record) => record.action}
        />
      ) : (
        <EmptyState
          description="Mutation history will appear as the team works."
          title="No audit events yet"
        />
      )}
    </section>
  );
}

const auditColumns: TableColumn<AuditRecord>[] = [
  {
    key: 'action',
    label: 'Action',
    render: (record) => <strong>{record.action}</strong>,
  },
  {
    key: 'entityType',
    label: 'Entity',
    render: (record) => <span className="mono">{record.entityType}</span>,
  },
  {
    key: 'actor',
    label: 'Actor',
    render: (record) => record.actor?.displayName ?? 'System',
  },
  {
    key: 'createdAt',
    label: 'When',
    render: (record) => formatDateTime(record.createdAt),
  },
];
