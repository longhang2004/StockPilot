'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ConfirmDialog,
  type ToastMessage,
} from '../../components/ui/operations-ui';
import { formatDateTime } from '../../lib/formatters';
import { resetDemo, type OrganizationSettings } from './api';

/**
 * Organization section: identity metadata plus the canonical demo reset.
 * Owns the reset mutation and its confirmation dialog; the workspace
 * supplies the loaded settings and the toast channel.
 */
export function OrganizationSettingsCard({
  push,
  settings,
}: {
  push: (message: string, tone?: ToastMessage['tone']) => void;
  settings: OrganizationSettings;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useMutation({
    mutationFn: resetDemo,
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

  return (
    <article className="guidance-card">
      <p className="eyebrow">Organization</p>
      <h2>{settings.name}</h2>
      <p className="mono">{settings.slug}</p>
      <dl className="detail-metadata">
        <div>
          <dt>Currency</dt>
          <dd>{settings.currency}</dd>
        </div>
        <div>
          <dt>Warehouse</dt>
          <dd>{settings.warehouse?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Next reset</dt>
          <dd>{formatDateTime(settings.nextDemoResetAt)}</dd>
        </div>
      </dl>
      <button
        className="button button-danger"
        onClick={() => setConfirmReset(true)}
        type="button"
      >
        Reset demo data
      </button>
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
    </article>
  );
}
