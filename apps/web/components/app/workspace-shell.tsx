'use client';

import { useEffect, useState } from 'react';

import { QueryProvider } from '../../lib/query-provider';
import { WorkspaceContent, type WorkspaceSection } from './workspace-content';
import {
  MobileWorkspaceNavigation,
  WorkspaceSidebar,
  type SessionView,
} from './workspace-navigation';
import {
  WorkspaceLoading,
  WorkspaceNoMembership,
  WorkspaceSessionExpired,
} from './workspace-session-state';
import type { WorkspaceSessionView } from '../../features/shared/types';

export type { WorkspaceSection };
export type { SessionView } from './workspace-navigation';

export function WorkspaceShell({
  section = 'overview',
}: {
  section?: WorkspaceSection;
}) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [state, setState] = useState<
    'loading' | 'ready' | 'expired' | 'no-membership'
  >('loading');

  useEffect(() => {
    let active = true;
    void fetch('/api/v1/auth/session', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session unavailable.');
        const body = (await response.json()) as SessionView;
        if (active) {
          setSession(body);
          setState(body.membership ? 'ready' : 'no-membership');
        }
      })
      .catch(() => {
        if (active) setState('expired');
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') return <WorkspaceLoading />;
  if (state === 'expired' || !session) return <WorkspaceSessionExpired />;
  if (state === 'no-membership') return <WorkspaceNoMembership />;

  const workspaceSession: WorkspaceSessionView = {
    membership: session.membership!,
    user: session.user,
  };
  const { organization } = workspaceSession.membership;
  return (
    <QueryProvider>
      <div className="workspace">
        <WorkspaceSidebar section={section} session={workspaceSession} />
        <main className="workspace-main">
          {organization.isDemo ? (
            <div className="demo-banner">
              <span>Demo workspace</span>Data resets every six hours. Changes
              are safe to explore.
            </div>
          ) : null}
          <WorkspaceContent section={section} session={workspaceSession} />
        </main>
        <MobileWorkspaceNavigation section={section} />
      </div>
    </QueryProvider>
  );
}
