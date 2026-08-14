import type { BillingStatusView, Role } from '@stockpilot/contracts';

import { apiRequest, newIdempotencyKey } from '../../lib/api-client';

export const settingsKeys = {
  organization: ['organization-settings'] as const,
  team: ['team'] as const,
  invitations: ['team-invitations'] as const,
  billing: ['billing-status'] as const,
};

export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  role: Role;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

export interface CreatedInvitation extends PendingInvitation {
  rawToken: string;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  slug: string;
  currency: string;
  isDemo: boolean;
  nextDemoResetAt: string | null;
  warehouse: { id: string; name: string } | null;
}

export function fetchOrganizationSettings(): Promise<OrganizationSettings> {
  return apiRequest<OrganizationSettings>('/organization/settings');
}

export function fetchTeam(): Promise<TeamMember[]> {
  return apiRequest<TeamMember[]>('/team');
}

export function fetchInvitations(): Promise<PendingInvitation[]> {
  return apiRequest<PendingInvitation[]>('/team/invitations');
}

export function fetchBillingStatus(): Promise<BillingStatusView> {
  return apiRequest<BillingStatusView>('/billing');
}

export function resetDemo(): Promise<unknown> {
  return apiRequest('/organization/demo-reset', {
    idempotencyKey: newIdempotencyKey('demo-reset'),
    method: 'POST',
  });
}

export function createInvitation(
  email: string,
  role: Exclude<Role, 'OWNER'>,
): Promise<CreatedInvitation> {
  return apiRequest<CreatedInvitation>('/team/invitations', {
    body: JSON.stringify({ email, role }),
    method: 'POST',
  });
}

export function revokeInvitation(invitationId: string): Promise<unknown> {
  return apiRequest(`/team/invitations/${invitationId}/revoke`, {
    method: 'POST',
  });
}

export function changeMemberRole(
  membershipId: string,
  role: Role,
): Promise<TeamMember> {
  return apiRequest<TeamMember>(`/team/members/${membershipId}/role`, {
    body: JSON.stringify({ role }),
    method: 'PATCH',
  });
}

export function removeMember(membershipId: string): Promise<unknown> {
  return apiRequest(`/team/members/${membershipId}`, { method: 'DELETE' });
}

export function createCheckoutSession(
  plan: 'STARTER' | 'PRO',
): Promise<{ url: string }> {
  return apiRequest<{ url: string }>('/billing/checkout', {
    body: JSON.stringify({ plan }),
    method: 'POST',
  });
}

export function createPortalSession(): Promise<{ url: string }> {
  return apiRequest<{ url: string }>('/billing/portal', { method: 'POST' });
}
