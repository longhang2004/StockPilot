'use client';

import { type Role } from '@stockpilot/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  ToastRegion,
} from '../../components/ui/operations-ui';
import { apiRequest, newIdempotencyKey } from '../../lib/api-client';
import { formatDateTime } from '../../lib/formatters';
import { useToasts } from '../../hooks/use-toasts';

export function SettingsWorkspace({ role }: { role: Role }) {
  const settings = useQuery({
    queryKey: ['organization-settings'],
    queryFn: () =>
      apiRequest<{
        id: string;
        name: string;
        slug: string;
        currency: string;
        isDemo: boolean;
        nextDemoResetAt: string | null;
        warehouse: { id: string; name: string } | null;
      }>('/organization/settings'),
    enabled: role === 'OWNER',
  });
  const team = useQuery({
    queryKey: ['team'],
    queryFn: () =>
      apiRequest<
        Array<{ id: string; displayName: string; email: string; role: Role }>
      >('/team'),
    enabled: role === 'OWNER',
  });
  const { push, toasts } = useToasts();
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useMutation({
    mutationFn: () =>
      apiRequest('/organization/demo-reset', {
        idempotencyKey: newIdempotencyKey('demo-reset'),
        method: 'POST',
      }),
    onError: (error) =>
      push(
        error instanceof Error ? error.message : 'Demo reset failed.',
        'error',
      ),
    onSuccess: () => {
      setConfirmReset(false);
      push('Demo data reset. Reloading…', 'success');
      window.setTimeout(() => window.location.assign('/app'), 400);
    },
  });
  if (role !== 'OWNER')
    return (
      <section className="workspace-section-page">
        <PageHeader
          description="Organization settings are visible to the Owner demo only."
          title="Organization settings"
        />
        <EmptyState
          description="Manager and Staff continue operating through their assigned workflows."
          title="Owner access required"
        />
      </section>
    );
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Read-only organization visibility and a safe demo reset."
        title="Organization settings"
      />
      {settings.isLoading || team.isLoading ? (
        <Skeleton lines={5} />
      ) : settings.isError || team.isError || !settings.data ? (
        <ErrorState
          description="Organization settings could not be loaded."
          onRetry={() => {
            void settings.refetch();
            void team.refetch();
          }}
        />
      ) : (
        <div className="settings-grid">
          <article className="guidance-card">
            <p className="eyebrow">Organization</p>
            <h2>{settings.data.name}</h2>
            <p className="mono">{settings.data.slug}</p>
            <dl className="detail-metadata">
              <div>
                <dt>Currency</dt>
                <dd>{settings.data.currency}</dd>
              </div>
              <div>
                <dt>Warehouse</dt>
                <dd>{settings.data.warehouse?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Next reset</dt>
                <dd>{formatDateTime(settings.data.nextDemoResetAt)}</dd>
              </div>
            </dl>
            <button
              className="button button-danger"
              onClick={() => setConfirmReset(true)}
              type="button"
            >
              Reset demo data
            </button>
          </article>
          <article className="guidance-card">
            <p className="eyebrow">Team view</p>
            <h2>Canonical demo memberships</h2>
            <div className="team-list">
              {team.data?.map((member) => (
                <div className="team-row" key={member.id}>
                  <span className="user-avatar" aria-hidden="true">
                    {member.displayName
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>{member.email}</small>
                  </span>
                  <StatusBadge
                    value={
                      member.role === 'OWNER'
                        ? 'SUCCEEDED'
                        : member.role === 'MANAGER'
                          ? 'CONFIRMED'
                          : 'DRAFT'
                    }
                  />
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
      <ToastRegion toasts={toasts} />
      <ConfirmDialog
        confirmLabel="Reset demo"
        destructive
        description="All demo operational data is restored to the seeded baseline. The action is idempotent and does not change canonical roles."
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => reset.mutate()}
        open={confirmReset}
        pending={reset.isPending}
        title="Reset demo data?"
      />
    </section>
  );
}
