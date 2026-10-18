'use client';

import type { Role } from '@stockpilot/contracts';
import { useState } from 'react';

import {
  Drawer,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  ResponsiveDataTable,
  Skeleton,
  type TableColumn,
} from '../../components/ui/operations-ui';
import { formatDateTime } from '../../lib/formatters';
import { usePage } from '../../hooks/use-page-query';
import { AUDIT_RESOURCE } from './api';
import { type AuditRecord } from '../shared/types';
import { useWorkspaceLocation } from '../shared/use-workspace-location';

export interface AuditChangeEntry {
  key: string;
  value: string;
  structured?: boolean;
}

/**
 * Turns a JSONB audit before/after snapshot into human-readable entries.
 * Scalar values render inline; nested objects and arrays render as compact
 * JSON so nothing is lost. Nullish and empty values are omitted.
 */
export function auditChangeEntries(
  change: Record<string, unknown> | null | undefined,
): AuditChangeEntry[] {
  if (!change) return [];
  return Object.entries(change).flatMap(([key, value]) => {
    if (value === null || value === undefined || value === '') return [];
    if (typeof value === 'object') {
      return [
        {
          key,
          structured: true,
          value: JSON.stringify(value, null, 2),
        },
      ];
    }
    return [{ key, value: String(value) }];
  });
}

export function AuditWorkspace({ role }: { role: Role }) {
  const { params, update } = useWorkspaceLocation();
  const entityType = params.get('entityType') || '';
  const entityId = params.get('entityId') || '';
  const eventId = params.get('eventId');
  const page = Number(params.get('page') || 1);
  const canRead = role === 'MANAGER' || role === 'OWNER';
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(
    null,
  );
  const audit = usePage<AuditRecord>(
    AUDIT_RESOURCE,
    {
      entityId: entityId || undefined,
      entityType: entityType || undefined,
      page,
      pageSize: 100,
    },
    { enabled: canRead },
  );
  const selected =
    selectedRecord ??
    audit.data?.items?.find((record) => record.id === eventId) ??
    null;
  if (role === 'STAFF')
    return (
      <section className="workspace-section-page">
        <PageHeader
          description="Audit history is available to managers and owners."
          title="Audit trail"
        />
        <EmptyState
          description="Ask a manager or owner to review the scoped audit history."
          title="Audit access required"
        />
      </section>
    );
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Trace actor, action, entity, and time behind every operational change."
        title="Audit trail"
      />
      {entityType || entityId ? (
        <div className="work-panel panel-heading">
          <p className="muted-note">
            Scoped to <strong>{entityType || 'any entity'}</strong> ·{' '}
            <span className="mono">{entityId || 'all IDs'}</span>
          </p>
          <button
            className="button button-secondary"
            onClick={() =>
              update(
                { entityType: null, entityId: null, eventId: null },
                'push',
              )
            }
            type="button"
          >
            Clear scope
          </button>
        </div>
      ) : null}
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
          onRowClick={(record) => {
            setSelectedRecord(record);
            update(
              {
                entityType: record.entityType,
                entityId: record.entityId,
                eventId: record.id,
              },
              'push',
            );
          }}
          selectedId={eventId ?? undefined}
        />
      ) : (
        <EmptyState
          description="Mutation history will appear as the team works."
          title="No audit events yet"
        />
      )}
      <Pagination
        onPageChange={(value) =>
          update({ page: value === 1 ? null : String(value) }, 'replace')
        }
        page={page}
        totalPages={audit.data?.totalPages ?? 0}
      />
      <AuditDetailDrawer
        onClose={() => {
          setSelectedRecord(null);
          update({ eventId: null }, 'push');
        }}
        open={Boolean(selected)}
        record={selected}
      />
    </section>
  );
}

function AuditDetailDrawer({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: AuditRecord | null;
}) {
  if (!record) return null;
  const before = auditChangeEntries(record.before);
  const after = auditChangeEntries(record.after);
  return (
    <Drawer
      description={`${record.entityType} · ${record.entityId}`}
      onClose={onClose}
      open={open}
      title={record.action}
    >
      <div className="audit-detail-stack">
        <dl className="audit-detail-meta">
          <div>
            <dt>Actor</dt>
            <dd>{record.actor?.displayName ?? 'System'}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{formatDateTime(record.createdAt)}</dd>
          </div>
        </dl>
        {before.length > 0 && (
          <section aria-label="Before state">
            <h3 className="audit-detail-heading">Before</h3>
            <AuditChangeList entries={before} />
          </section>
        )}
        {after.length > 0 && (
          <section aria-label="After state">
            <h3 className="audit-detail-heading">After</h3>
            <AuditChangeList entries={after} />
          </section>
        )}
      </div>
    </Drawer>
  );
}

function AuditChangeList({ entries }: { entries: AuditChangeEntry[] }) {
  return (
    <dl className="audit-change-list">
      {entries.map((entry) => (
        <div key={entry.key}>
          <dt>{entry.key}</dt>
          <dd>
            {entry.structured ? (
              <pre className="audit-change-json">{entry.value}</pre>
            ) : (
              entry.value
            )}
          </dd>
        </div>
      ))}
    </dl>
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
    align: 'right',
    render: (record) => formatDateTime(record.createdAt),
  },
];
