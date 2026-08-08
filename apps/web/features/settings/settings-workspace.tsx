'use client';

import { type Role } from '@stockpilot/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, LinkSimple, Trash } from '@phosphor-icons/react';
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
import {
  ApiProblem,
  apiRequest,
  newIdempotencyKey,
} from '../../lib/api-client';
import { formatDateTime } from '../../lib/formatters';
import { useToasts } from '../../hooks/use-toasts';
import { BillingCard } from './billing-card';

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  role: Role;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

interface CreatedInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
  rawToken: string;
}

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STAFF', label: 'Staff' },
];

const inviteableRoles: Array<{ value: Exclude<Role, 'OWNER'>; label: string }> =
  [
    { value: 'MANAGER', label: 'Manager' },
    { value: 'STAFF', label: 'Staff' },
  ];

const friendlyErrors: Record<string, string> = {
  ALREADY_A_MEMBER: 'This email is already a member of the workspace.',
  FORBIDDEN_ROLE_CHANGE: 'Invitations can only grant Manager or Staff roles.',
  INVITATION_ALREADY_PENDING:
    'An invitation for this email is already pending.',
  LAST_OWNER_REQUIRED: 'The workspace must keep at least one Owner.',
  MEMBER_NOT_FOUND: 'This team member no longer exists.',
  PLAN_FEATURE_UNAVAILABLE:
    'This is a Pro feature. Upgrade from the Billing section.',
  PLAN_LIMIT_REACHED:
    'Your plan limits the team size. Upgrade from the Billing section.',
};

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiProblem) {
    return friendlyErrors[cause.code] ?? cause.message ?? fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

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
    queryFn: () => apiRequest<TeamMember[]>('/team'),
    enabled: role === 'OWNER',
  });
  const invitations = useQuery({
    queryKey: ['team-invitations'],
    queryFn: () => apiRequest<PendingInvitation[]>('/team/invitations'),
    enabled: role === 'OWNER',
  });
  const { push, toasts } = useToasts();
  const queryClient = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] =
    useState<Exclude<Role, 'OWNER'>>('MANAGER');
  const [createdInvite, setCreatedInvite] = useState<CreatedInvitation | null>(
    null,
  );
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);

  const refreshTeam = () => {
    void queryClient.invalidateQueries({ queryKey: ['team'] });
    void queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
  };

  const reset = useMutation({
    mutationFn: () =>
      apiRequest('/organization/demo-reset', {
        idempotencyKey: newIdempotencyKey('demo-reset'),
        method: 'POST',
      }),
    onError: (error) =>
      push(errorMessage(error, 'Demo reset failed.'), 'error'),
    onSuccess: () => {
      setConfirmReset(false);
      push('Demo data reset. Reloading…', 'success');
      window.setTimeout(() => window.location.assign('/app'), 400);
    },
  });

  const invite = useMutation({
    mutationFn: () =>
      apiRequest<CreatedInvitation>('/team/invitations', {
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        method: 'POST',
      }),
    onError: (error) =>
      setInviteError(errorMessage(error, 'The invitation could not be sent.')),
    onSuccess: (result) => {
      setInviteEmail('');
      setInviteError(null);
      setCreatedInvite(result);
      push(`Invitation sent to ${result.email}.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
    },
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest(`/team/invitations/${invitationId}/revoke`, {
        method: 'POST',
      }),
    onError: (error) => push(errorMessage(error, 'Could not revoke.'), 'error'),
    onSuccess: () => {
      push('Invitation revoked.', 'success');
      refreshTeam();
    },
  });

  const changeRole = useMutation({
    mutationFn: ({
      membershipId,
      nextRole,
    }: {
      membershipId: string;
      nextRole: Role;
    }) =>
      apiRequest<TeamMember>(`/team/members/${membershipId}/role`, {
        body: JSON.stringify({ role: nextRole }),
        method: 'PATCH',
      }),
    onError: (error) =>
      push(errorMessage(error, 'The role could not be changed.'), 'error'),
    onSuccess: () => {
      push('Role updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (membershipId: string) =>
      apiRequest(`/team/members/${membershipId}`, { method: 'DELETE' }),
    onError: (error) =>
      push(errorMessage(error, 'The member could not be removed.'), 'error'),
    onSuccess: () => {
      setConfirmRemove(null);
      push('Member removed.', 'success');
      refreshTeam();
    },
  });

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invitations/accept?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      push('Invite link copied.', 'success');
    } catch {
      push(link, 'info');
    }
  };

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
        description="Manage the workspace, the team, and invitation access."
        title="Organization settings"
      />
      {settings.isLoading || team.isLoading || invitations.isLoading ? (
        <Skeleton lines={5} />
      ) : settings.isError || team.isError || !settings.data ? (
        <ErrorState
          description="Organization settings could not be loaded."
          onRetry={() => {
            void settings.refetch();
            void team.refetch();
            void invitations.refetch();
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
            <p className="eyebrow">Team</p>
            <h2>Members</h2>
            <div className="team-list">
              {(team.data ?? []).map((member) => (
                <div className="team-row team-row-managed" key={member.id}>
                  <span className="user-avatar" aria-hidden="true">
                    {member.displayName
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <span className="team-row-identity">
                    <strong>{member.displayName}</strong>
                    <small>{member.email}</small>
                  </span>
                  <select
                    aria-label={`Role for ${member.displayName}`}
                    disabled={changeRole.isPending}
                    onChange={(event) =>
                      changeRole.mutate({
                        membershipId: member.id,
                        nextRole: event.target.value as Role,
                      })
                    }
                    value={member.role}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label={`Remove ${member.displayName}`}
                    className="button icon-button"
                    onClick={() => setConfirmRemove(member)}
                    type="button"
                  >
                    <Trash size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="guidance-card">
            <p className="eyebrow">Team</p>
            <h2>Invite a teammate</h2>{' '}
            <form
              className="form-stack team-invite-form"
              onSubmit={(event) => {
                event.preventDefault();
                invite.mutate();
              }}
            >
              {inviteError ? (
                <p className="form-error" role="alert">
                  {inviteError}
                </p>
              ) : null}
              <div className="form-field">
                <label htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                  type="email"
                  value={inviteEmail}
                />
              </div>
              <div className="form-field">
                <label htmlFor="invite-role">Role</label>
                <select
                  id="invite-role"
                  onChange={(event) =>
                    setInviteRole(event.target.value as Exclude<Role, 'OWNER'>)
                  }
                  value={inviteRole}
                >
                  {inviteableRoles.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="button button-primary"
                disabled={invite.isPending}
                type="submit"
              >
                {invite.isPending ? 'Creating invitation…' : 'Invite teammate'}
              </button>
            </form>
            {createdInvite ? (
              <div className="invite-link-box" role="status">
                <LinkSimple size={16} aria-hidden="true" />
                <span>
                  Share this link with {createdInvite.email}. It expires{' '}
                  {formatDateTime(createdInvite.expiresAt)}.
                </span>
                <button
                  aria-label="Copy invite link"
                  className="button icon-button"
                  onClick={() => void copyInviteLink(createdInvite.rawToken)}
                  type="button"
                >
                  <Copy size={16} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <h3 className="pending-invites-heading">Pending invitations</h3>
            {invitations.data && invitations.data.length > 0 ? (
              <div className="team-list">
                {invitations.data.map((pending) => (
                  <div className="team-row team-row-managed" key={pending.id}>
                    <span className="team-row-identity">
                      <strong>{pending.email}</strong>
                      <small>
                        {roleOptions.find((o) => o.value === pending.role)
                          ?.label ?? pending.role}{' '}
                        · expires {formatDateTime(pending.expiresAt)}
                      </small>
                    </span>
                    <StatusBadge value="CONFIRMED" />
                    <button
                      aria-label={`Revoke invitation for ${pending.email}`}
                      className="button icon-button"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(pending.id)}
                      type="button"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-note">No pending invitations.</p>
            )}
          </article>
          <BillingCard />
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
      <ConfirmDialog
        confirmLabel="Remove member"
        destructive
        description={
          confirmRemove
            ? `${confirmRemove.displayName} (${confirmRemove.email}) loses access to this workspace immediately.`
            : ''
        }
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeMember.mutate(confirmRemove.id);
        }}
        open={Boolean(confirmRemove)}
        pending={removeMember.isPending}
        title="Remove team member?"
      />
    </section>
  );
}
