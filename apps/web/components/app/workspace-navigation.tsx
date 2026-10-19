'use client';

import {
  Archive,
  ClipboardText,
  Cube,
  GearSix,
  House,
  Package,
  PlugsConnected,
  Receipt,
  SlidersHorizontal,
  UsersThree,
} from '@phosphor-icons/react';
import type { Role } from '@stockpilot/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { WorkspaceSessionView } from '../../features/shared/types';
import {
  workspaceSectionHref,
  WORKSPACE_SECTION_LABELS,
  type WorkspaceSection,
} from '../../features/workspace/sections';
import {
  apiRequest,
  clearCsrfToken,
  type WorkspaceSummary,
} from '../../lib/api-client';

export type SessionView = WorkspaceSessionView;

const navigation: Array<{
  label: string;
  section: WorkspaceSection;
  icon: typeof House;
}> = [
  {
    label: WORKSPACE_SECTION_LABELS.overview,
    section: 'overview',
    icon: House,
  },
  {
    label: WORKSPACE_SECTION_LABELS.orders,
    section: 'orders',
    icon: ClipboardText,
  },
  {
    label: WORKSPACE_SECTION_LABELS.inventory,
    section: 'inventory',
    icon: Cube,
  },
  {
    label: WORKSPACE_SECTION_LABELS.products,
    section: 'products',
    icon: Package,
  },
  {
    label: WORKSPACE_SECTION_LABELS.partners,
    section: 'partners',
    icon: UsersThree,
  },
  {
    label: WORKSPACE_SECTION_LABELS.receipts,
    section: 'receipts',
    icon: Receipt,
  },
  {
    label: WORKSPACE_SECTION_LABELS.imports,
    section: 'imports',
    icon: Archive,
  },
  {
    label: WORKSPACE_SECTION_LABELS.integrations,
    section: 'integrations',
    icon: PlugsConnected,
  },
  { label: WORKSPACE_SECTION_LABELS.audit, section: 'audit', icon: GearSix },
  {
    label: WORKSPACE_SECTION_LABELS.settings,
    section: 'settings',
    icon: SlidersHorizontal,
  },
];

const navigationGroups = [
  { label: 'Operations', sections: ['overview', 'orders', 'inventory'] },
  { label: 'Records', sections: ['products', 'partners', 'receipts'] },
  { label: 'Review', sections: ['imports', 'integrations', 'audit'] },
] as const;

/**
 * Owner-only administration entry (UX-03). Rendering stays client-side and
 * merely discovers the route; /app/settings access is still enforced by the
 * server-side role checks, so this adds no privilege.
 */
const ownerNavigationGroups = [
  { label: 'Administration', sections: ['settings'] },
] as const;

const roleLabels: Record<Role, string> = {
  MANAGER: 'Manager',
  OWNER: 'Owner',
  STAFF: 'Staff',
};

const allRoles: Role[] = ['OWNER', 'MANAGER', 'STAFF'];

/**
 * Demo-only control that swaps the canonical demo membership server-side
 * (POST /auth/demo-login) and reloads the workspace. Never rendered for
 * non-demo organizations, so normal users get no impersonation surface.
 */
export function DemoRoleSwitcher({
  currentRole,
  compact = false,
}: {
  currentRole: Role;
  compact?: boolean;
}) {
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const switchRole = async (role: Role) => {
    if (role === currentRole) return;
    setPendingRole(role);
    setError(null);
    try {
      await apiRequest('/auth/demo-login', {
        body: JSON.stringify({ role }),
        method: 'POST',
      });
      window.location.assign('/app');
    } catch (cause) {
      setPendingRole(null);
      setError(
        cause instanceof Error ? cause.message : 'Could not switch role.',
      );
    }
  };
  return (
    <div className={`demo-role-switcher${compact ? ' demo-role-compact' : ''}`}>
      <span className="demo-role-label">Demo workspace</span>
      <label>
        <span>Current role</span>
        <select
          aria-label="Switch demo role"
          disabled={pendingRole !== null}
          onChange={(event) => void switchRole(event.target.value as Role)}
          value={pendingRole ?? currentRole}
        >
          {allRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
              {pendingRole === role ? ' (switching…)' : ''}
            </option>
          ))}
        </select>
      </label>
      {error ? <small className="form-error">{error}</small> : null}
    </div>
  );
}

function isActive(href: string, section: WorkspaceSection): boolean {
  return href === workspaceSectionHref(section);
}

/**
 * Switches the active workspace through the server-side session endpoint.
 * Membership is verified on the API; the selected organization id is only a
 * requested destination. Hidden when the user belongs to a single workspace.
 */
function WorkspaceSwitcher({
  currentOrganizationId,
}: {
  currentOrganizationId: string;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    let active = true;
    void apiRequest<WorkspaceSummary[]>('/auth/workspaces')
      .then((items) => {
        // apiRequest substitutes an empty object for missing bodies; only an
        // array is a real workspace list, anything else hides the switcher.
        if (active) setWorkspaces(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setWorkspaces([]);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!workspaces || workspaces.length <= 1) return null;
  const switchTo = async (organizationId: string) => {
    if (organizationId === currentOrganizationId || switching) return;
    setSwitching(true);
    try {
      await apiRequest('/auth/switch-workspace', {
        body: JSON.stringify({ organizationId }),
        method: 'POST',
      });
      window.location.assign('/app');
    } catch {
      setSwitching(false);
    }
  };
  return (
    <select
      aria-label="Switch workspace"
      disabled={switching}
      onChange={(event) => void switchTo(event.target.value)}
      value={currentOrganizationId}
    >
      {workspaces.map((workspace) => (
        <option key={workspace.organizationId} value={workspace.organizationId}>
          {workspace.organization.name} · {roleLabels[workspace.role]}
        </option>
      ))}
    </select>
  );
}

export function WorkspaceSidebar({
  section,
  role,
}: {
  section: WorkspaceSection;
  role?: Role;
}) {
  const groups =
    role === 'OWNER'
      ? [...navigationGroups, ...ownerNavigationGroups]
      : [...navigationGroups];
  return (
    <aside className="workspace-sidebar">
      <nav aria-label="Workspace navigation">
        {groups.map((group) => (
          <div className="workspace-nav-group" key={group.label}>
            <span className="workspace-nav-group-label">{group.label}</span>
            {group.sections.map((groupSection) => {
              const item = navigation.find(
                ({ section: itemSection }) => itemSection === groupSection,
              );
              if (!item) return null;
              const { section: navSection, icon: Icon, label } = item;
              const href = workspaceSectionHref(navSection);
              return (
                <Link
                  aria-current={isActive(href, section) ? 'page' : undefined}
                  className={`workspace-nav-link${isActive(href, section) ? ' workspace-nav-active' : ''}`}
                  href={href}
                  key={href}
                >
                  <Icon size={16} weight="regular" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function WorkspaceHeader({ session }: { session: SessionView }) {
  const initials = session.user.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
  const { organization } = session.membership;

  return (
    <header className="workspace-topbar">
      <Link className="brand workspace-brand" href="/app">
        <span className="brand-mark" aria-hidden="true">
          SP
        </span>
        <span>StockPilot</span>
      </Link>
      <div className="topbar-organization">
        <span>Workspace</span>
        <WorkspaceSwitcher currentOrganizationId={organization.id} />
        <strong>{organization.name}</strong>
        <small>{organization.currency} · Main Warehouse</small>
      </div>
      <div className="topbar-session">
        {organization.isDemo ? (
          <DemoRoleSwitcher currentRole={session.membership.role} compact />
        ) : null}
        <div className="workspace-user">
          <span className="user-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="user-identity">
            <strong>{session.user.displayName}</strong>
            <small>{roleLabels[session.membership.role]}</small>
          </span>
        </div>
        <WorkspaceSignOut />
      </div>
    </header>
  );
}

export function WorkspaceSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      clearCsrfToken();
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Sign out did not complete. Try again.');
      setPending(false);
    }
  }

  return (
    <div className="workspace-sign-out-wrap">
      <button
        aria-busy={pending}
        className="workspace-sign-out"
        disabled={pending}
        onClick={() => void signOut()}
        type="button"
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? (
        <span className="workspace-sign-out-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function MobileWorkspaceNavigation({
  section,
}: {
  section: WorkspaceSection;
}) {
  return (
    <nav
      className="mobile-workspace-nav"
      aria-label="Mobile workspace navigation"
    >
      {navigation
        .slice(0, 3)
        .map(({ section: navSection, icon: Icon, label }) => {
          const href = workspaceSectionHref(navSection);
          return (
            <Link
              aria-current={isActive(href, section) ? 'page' : undefined}
              className={
                isActive(href, section) ? 'mobile-nav-active' : undefined
              }
              href={href}
              key={href}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      <Link
        aria-current={section === 'more' ? 'page' : undefined}
        className={section === 'more' ? 'mobile-nav-active' : undefined}
        href="/app/more"
      >
        <GearSix size={18} aria-hidden="true" />
        <span>More</span>
      </Link>
    </nav>
  );
}
