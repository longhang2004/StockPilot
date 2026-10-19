'use client';

import { useEffect, useState } from 'react';

import { QueryProvider } from '../../lib/query-provider';
import { CommandIntentScope } from '../../hooks/use-command-mutation';
import { WorkspaceContent, type WorkspaceSection } from './workspace-content';
import {
  MobileWorkspaceNavigation,
  WorkspaceHeader,
  WorkspaceSidebar,
  type SessionView,
} from './workspace-navigation';
import {
  WorkspaceLoading,
  WorkspaceNoMembership,
  WorkspaceSessionExpired,
  WorkspaceUnavailable,
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
    'loading' | 'ready' | 'expired' | 'no-membership' | 'unavailable'
  >('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    void fetch('/api/v1/auth/session', { credentials: 'include' })
      .then(async (response) => {
        // Only 401 means the session is gone; network drops and 5xx cold
        // starts are temporary and must not sign the operator out.
        if (response.status === 401) {
          if (active) setState('expired');
          return;
        }
        if (!response.ok)
          throw new Error(`Session check failed (${response.status}).`);
        const body = (await response.json()) as SessionView;
        if (active) {
          setSession(body);
          setState(body.membership ? 'ready' : 'no-membership');
        }
      })
      .catch(() => {
        if (active) setState('unavailable');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state === 'loading') return <WorkspaceLoading />;
  if (state === 'unavailable')
    return (
      <WorkspaceUnavailable onRetry={() => setAttempt((value) => value + 1)} />
    );
  if (state === 'expired' || !session) return <WorkspaceSessionExpired />;
  if (state === 'no-membership') return <WorkspaceNoMembership />;

  const workspaceSession: WorkspaceSessionView = {
    membership: session.membership!,
    user: session.user,
  };
  const { organization } = workspaceSession.membership;
  const commandScope = `${organization.id}:${workspaceSession.user.id}`;
  return (
    <QueryProvider>
      <CommandIntentScope.Provider key={commandScope} value={commandScope}>
        <div className="workspace">
          <WorkspaceHeader session={workspaceSession} />
          <div className="workspace-layout">
            <WorkspaceSidebar
              role={workspaceSession.membership.role}
              section={section}
            />
            <main className="workspace-main">
              {organization.isDemo ? (
                <div className="demo-banner">
                  <span>Demo workspace</span>Data resets every six hours.
                  Changes are safe to explore.
                </div>
              ) : null}
              <WorkspaceContent section={section} session={workspaceSession} />
            </main>
          </div>
          <MobileWorkspaceNavigation section={section} />
        </div>
      </CommandIntentScope.Provider>
    </QueryProvider>
  );
}
