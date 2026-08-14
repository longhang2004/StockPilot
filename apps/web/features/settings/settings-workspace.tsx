'use client';

import { type Role } from '@stockpilot/contracts';
import { useQuery } from '@tanstack/react-query';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  ToastRegion,
} from '../../components/ui/operations-ui';
import { useToasts } from '../../hooks/use-toasts';
import { BillingCard } from './billing-card';
import { InvitationsCard } from './invitations-card';
import { OrganizationSettingsCard } from './organization-card';
import { TeamMembersCard } from './team-card';
import {
  fetchInvitations,
  fetchOrganizationSettings,
  fetchTeam,
  settingsKeys,
} from './api';

/**
 * Organization settings page: loads the three owner-only data sections and
 * composes them into the settings grid. Each section card owns its own
 * mutations and dialogs; this workspace owns the shared loading/error gate
 * and the single toast region.
 */
export function SettingsWorkspace({ role }: { role: Role }) {
  const { push, toasts } = useToasts();
  const settings = useQuery({
    queryKey: settingsKeys.organization,
    queryFn: fetchOrganizationSettings,
    enabled: role === 'OWNER',
  });
  const team = useQuery({
    queryKey: settingsKeys.team,
    queryFn: fetchTeam,
    enabled: role === 'OWNER',
  });
  const invitations = useQuery({
    queryKey: settingsKeys.invitations,
    queryFn: fetchInvitations,
    enabled: role === 'OWNER',
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
          <OrganizationSettingsCard push={push} settings={settings.data} />
          <TeamMembersCard members={team.data ?? []} push={push} />
          <InvitationsCard invitations={invitations.data ?? []} push={push} />
          <BillingCard />
        </div>
      )}
      <ToastRegion toasts={toasts} />
    </section>
  );
}
