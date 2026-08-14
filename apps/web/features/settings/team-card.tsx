'use client';

import type { Role } from '@stockpilot/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash } from '@phosphor-icons/react';
import { useState } from 'react';

import {
  ConfirmDialog,
  type ToastMessage,
} from '../../components/ui/operations-ui';
import { ApiProblem } from '../../lib/api-client';
import {
  changeMemberRole,
  removeMember,
  settingsKeys,
  type TeamMember,
} from './api';

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STAFF', label: 'Staff' },
];

const friendlyErrors: Record<string, string> = {
  LAST_OWNER_REQUIRED: 'The workspace must keep at least one Owner.',
  MEMBER_NOT_FOUND: 'This team member no longer exists.',
};

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiProblem) {
    return friendlyErrors[cause.code] ?? cause.message ?? fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

/**
 * Team section: membership rows with role change and removal controls.
 * Owns the role-change and removal mutations and the removal confirmation
 * dialog; the workspace supplies the loaded members and the toast channel.
 */
export function TeamMembersCard({
  members,
  push,
}: {
  members: TeamMember[];
  push: (message: string, tone?: ToastMessage['tone']) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);

  const changeRole = useMutation({
    mutationFn: ({
      membershipId,
      nextRole,
    }: {
      membershipId: string;
      nextRole: Role;
    }) => changeMemberRole(membershipId, nextRole),
    onError: (error) =>
      push(errorMessage(error, 'The role could not be changed.'), 'error'),
    onSuccess: () => {
      push('Role updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: settingsKeys.team });
    },
  });

  const remove = useMutation({
    mutationFn: (membershipId: string) => removeMember(membershipId),
    onError: (error) =>
      push(errorMessage(error, 'The member could not be removed.'), 'error'),
    onSuccess: () => {
      setConfirmRemove(null);
      push('Member removed.', 'success');
      void queryClient.invalidateQueries({ queryKey: settingsKeys.team });
      void queryClient.invalidateQueries({
        queryKey: settingsKeys.invitations,
      });
    },
  });

  return (
    <article className="guidance-card">
      <p className="eyebrow">Team</p>
      <h2>Members</h2>
      <div className="team-list">
        {members.map((member) => (
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
          if (confirmRemove) remove.mutate(confirmRemove.id);
        }}
        open={Boolean(confirmRemove)}
        pending={remove.isPending}
        title="Remove team member?"
      />
    </article>
  );
}
