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
  WorkspaceSessionExpired,
} from './workspace-session-state';

export type { WorkspaceSection };
export type { SessionView } from './workspace-navigation';

export function WorkspaceShell({
  section = 'overview',
}: {
  section?: WorkspaceSection;
}) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'expired'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    void fetch('/api/v1/auth/session', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session unavailable.');
        const body = (await response.json()) as SessionView;
        if (active) {
          setSession(body);
          setState('ready');
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

  return (
    <QueryProvider>
      <div className="workspace">
        <WorkspaceSidebar section={section} session={session} />
        <main className="workspace-main">
          <div className="demo-banner">
            <span>Demo workspace</span>Data resets every six hours. Changes are
            safe to explore.
          </div>
          <WorkspaceContent section={section} session={session} />
        </main>
        <MobileWorkspaceNavigation section={section} />
      </div>
    </QueryProvider>
  );
}
