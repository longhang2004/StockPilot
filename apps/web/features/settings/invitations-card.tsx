'use client';

import type { Role } from '@stockpilot/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, LinkSimple, Trash } from '@phosphor-icons/react';
import { useState } from 'react';

import {
  StatusBadge,
  type ToastMessage,
} from '../../components/ui/operations-ui';
import { ApiProblem } from '../../lib/api-client';
import { formatDateTime } from '../../lib/formatters';
import {
  createInvitation,
  revokeInvitation,
  settingsKeys,
  type PendingInvitation,
} from './api';

const inviteableRoles: Array<{ value: Exclude<Role, 'OWNER'>; label: string }> =
  [
    { value: 'MANAGER', label: 'Manager' },
    { value: 'STAFF', label: 'Staff' },
  ];

const roleLabels: Record<Role, string> = {
  MANAGER: 'Manager',
  OWNER: 'Owner',
  STAFF: 'Staff',
};

const friendlyErrors: Record<string, string> = {
  ALREADY_A_MEMBER: 'This email is already a member of the workspace.',
  FORBIDDEN_ROLE_CHANGE: 'Invitations can only grant Manager or Staff roles.',
  INVITATION_ALREADY_PENDING:
    'An invitation for this email is already pending.',
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

/**
 * Invitations section: the invite form, the one-time share link for a
 * freshly created invitation, and the pending list. Owns the invite and
 * revoke mutations plus the created-invitation flow; the workspace supplies
 * the pending list and the toast channel.
 */
export function InvitationsCard({
  invitations,
  push,
}: {
  invitations: PendingInvitation[];
  push: (message: string, tone?: ToastMessage['tone']) => void;
}) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] =
    useState<Exclude<Role, 'OWNER'>>('MANAGER');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    email: string;
    expiresAt: string;
    rawToken: string;
  } | null>(null);

  const refreshInvitations = () =>
    void queryClient.invalidateQueries({ queryKey: settingsKeys.invitations });

  const invite = useMutation({
    mutationFn: () => createInvitation(inviteEmail, inviteRole),
    onError: (error) =>
      setInviteError(errorMessage(error, 'The invitation could not be sent.')),
    onSuccess: (result) => {
      setInviteEmail('');
      setInviteError(null);
      setCreatedInvite(result);
      push(`Invitation sent to ${result.email}.`, 'success');
      refreshInvitations();
    },
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onError: (error) => push(errorMessage(error, 'Could not revoke.'), 'error'),
    onSuccess: () => {
      push('Invitation revoked.', 'success');
      refreshInvitations();
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

  return (
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
      {invitations.length > 0 ? (
        <div className="team-list">
          {invitations.map((pending) => (
            <div className="team-row team-row-managed" key={pending.id}>
              <span className="team-row-identity">
                <strong>{pending.email}</strong>
                <small>
                  {roleLabels[pending.role]} · expires{' '}
                  {formatDateTime(pending.expiresAt)}
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
  );
}
