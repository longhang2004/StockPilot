'use client';

import { ArrowUpRight } from '@phosphor-icons/react';
import Link from 'next/link';

export function WorkspaceLoading() {
  return (
    <main className="workspace-loading" aria-live="polite">
      <span className="loading-mark" aria-hidden="true">
        SP
      </span>
      <p>Preparing the wholesale workspace…</p>
    </main>
  );
}

export function WorkspaceSessionExpired() {
  return (
    <main className="session-expired">
      <div>
        <span className="brand-mark" aria-hidden="true">
          SP
        </span>
        <p className="kicker">Authentication required</p>
        <h1>Your demo session has expired.</h1>
        <p role="alert">
          Your session has expired. Start a fresh role-based session to continue
          exploring StockPilot.
        </p>
        <Link className="button button-primary" href="/login">
          Return to demo login
          <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}

/**
 * Temporary connectivity problem (network drop, 502/503 cold start). Kept
 * separate from an expired session so a blip never signs the operator out.
 */
export function WorkspaceUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="session-expired">
      <div>
        <span className="brand-mark" aria-hidden="true">
          SP
        </span>
        <p className="kicker">Connection problem</p>
        <h1>We could not reach the workspace.</h1>
        <p role="alert">
          This is usually temporary — a cold start or a dropped connection. The
          session is untouched; retry when the network settles.
        </p>
        <button
          className="button button-primary"
          onClick={onRetry}
          type="button"
        >
          Try again
          <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

export function WorkspaceNoMembership() {
  return (
    <main className="session-expired">
      <div>
        <span className="brand-mark" aria-hidden="true">
          SP
        </span>
        <p className="kicker">Almost there</p>
        <h1>You are not in a workspace yet.</h1>
        <p role="alert">
          Create a workspace to become its Owner, or accept a teammate
          invitation link.
        </p>
        <Link className="button button-primary" href="/create-workspace">
          Create a workspace
          <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
