import type { Plan } from '@stockpilot/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, X } from '@phosphor-icons/react';
import { useState } from 'react';

import { ApiProblem } from '../../lib/api-client';
import {
  createCheckoutSession,
  createPortalSession,
  fetchBillingStatus,
  settingsKeys,
} from './api';
import { formatDateTime } from '../../lib/formatters';

const friendlyErrors: Record<string, string> = {
  BILLING_DISABLED_FOR_DEMO:
    'Billing changes are disabled in the shared demo workspace.',
  BILLING_NOT_CONFIGURED: 'Billing is not configured for this deployment yet.',
  BILLING_NO_SUBSCRIPTION:
    'This workspace does not have a billing relationship yet.',
};

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiProblem) {
    return friendlyErrors[cause.code] ?? cause.message ?? fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

function EntitlementRow({
  included,
  label,
}: {
  included: boolean;
  label: string;
}) {
  return (
    <div className="entitlement-row">
      <span>{label}</span>
      {included ? (
        <span className="entitlement-included">
          <Check size={14} aria-hidden="true" /> Included
        </span>
      ) : (
        <span className="entitlement-missing">
          <X size={14} aria-hidden="true" /> Not included
        </span>
      )}
    </div>
  );
}

export function BillingCard() {
  const billing = useQuery({
    queryKey: settingsKeys.billing,
    queryFn: fetchBillingStatus,
  });
  const [selectedPlan, setSelectedPlan] = useState<Plan>('PRO');
  const [error, setError] = useState<string | null>(null);

  const checkout = useMutation({
    mutationFn: () => createCheckoutSession(selectedPlan),
    onError: (cause) => setError(errorMessage(cause, 'Checkout failed.')),
    onSuccess: (result) => {
      window.location.assign(result.url);
    },
  });

  const portal = useMutation({
    mutationFn: createPortalSession,
    onError: (cause) => setError(errorMessage(cause, 'Billing portal failed.')),
    onSuccess: (result) => {
      window.location.assign(result.url);
    },
  });

  if (billing.isLoading) return null;
  if (billing.isError || !billing.data) {
    return (
      <article className="guidance-card settings-card-wide">
        <p className="eyebrow">Billing</p>
        <h2>Subscription</h2>
        <p className="muted-note">Billing status could not be loaded.</p>
      </article>
    );
  }

  const status = billing.data;
  const hasActiveSubscription =
    status.status === 'ACTIVE' || status.status === 'TRIALING';
  const canChangeBilling = !status.isDemoBilling && !status.cancelAtPeriodEnd;

  return (
    <article className="guidance-card settings-card-wide">
      <p className="eyebrow">Billing</p>
      <div className="billing-heading">
        <h2>
          {status.isDemoBilling ? 'Demo Pro plan' : `${status.plan} plan`}
        </h2>
        <span className={`plan-badge plan-badge-${status.plan.toLowerCase()}`}>
          {status.plan}
        </span>
      </div>

      {status.isDemoBilling ? (
        <p className="demo-billing-note" role="status">
          All Pro features are enabled for this shared demo workspace. Billing
          changes are disabled in demo mode.
        </p>
      ) : (
        <dl className="detail-metadata">
          <div>
            <dt>Subscription status</dt>
            <dd>{status.status ?? 'No subscription yet'}</dd>
          </div>
          {status.currentPeriodEnd ? (
            <div>
              <dt>Current period ends</dt>
              <dd>{formatDateTime(status.currentPeriodEnd)}</dd>
            </div>
          ) : null}
          {status.cancelAtPeriodEnd ? (
            <div>
              <dt>Cancellation</dt>
              <dd>Scheduled at period end</dd>
            </div>
          ) : null}
        </dl>
      )}

      <div className="billing-members">
        <span>Team members</span>
        <strong>
          {status.teamUsage.members} / {status.teamUsage.limit}
        </strong>
      </div>

      <div className="entitlement-list">
        <EntitlementRow
          included={status.entitlements.csvImport}
          label="CSV product import"
        />
        <EntitlementRow
          included={status.entitlements.integrations}
          label="Integrations"
        />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {status.isDemoBilling ? null : (
        <div className="billing-actions">
          {hasActiveSubscription && canChangeBilling ? (
            <button
              className="button button-secondary"
              disabled={portal.isPending}
              onClick={() => portal.mutate()}
              type="button"
            >
              Manage billing
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          ) : null}
          <div className="plan-picker">
            <label htmlFor="plan-select">Plan</label>
            <select
              disabled={checkout.isPending || hasActiveSubscription}
              id="plan-select"
              onChange={(event) => setSelectedPlan(event.target.value as Plan)}
              value={selectedPlan}
            >
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
            </select>
            <button
              className="button button-primary"
              disabled={checkout.isPending || hasActiveSubscription}
              onClick={() => checkout.mutate()}
              type="button"
            >
              {checkout.isPending
                ? 'Preparing checkout…'
                : hasActiveSubscription
                  ? 'Active'
                  : status.status === 'INCOMPLETE'
                    ? 'Complete checkout'
                    : 'Start subscription'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
