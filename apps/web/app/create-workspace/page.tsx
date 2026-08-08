'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiRequest } from '../../lib/api-client';
import { MarketingArrowLeftIcon } from '../../components/ui/marketing-icons';

type Phase = 'loading' | 'signed-out' | 'in-workspace' | 'form';

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/v1/auth/session', { credentials: 'include' })
      .then(async (response) => {
        const body = (await response.json()) as {
          membership: { organization: { name: string } } | null;
        };
        if (!active) return;
        if (!response.ok || !body.membership) {
          setPhase(response.ok ? 'form' : 'signed-out');
          return;
        }
        // Already in a workspace: return to it.
        router.replace('/app');
      })
      .catch(() => {
        if (active) setPhase('signed-out');
      });
    return () => {
      active = false;
    };
  }, [router]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest('/organizations', {
        body: JSON.stringify({ name }),
        method: 'POST',
      });
      router.push('/app');
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The workspace could not be created.',
      );
      setPending(false);
    }
  };

  return (
    <main className="login-page">
      <header className="login-header">
        <Link className="brand" href="/" aria-label="Back to StockPilot home">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </Link>
        <Link className="text-link" href="/app">
          <MarketingArrowLeftIcon />
          Back to workspace
        </Link>
      </header>

      <section
        className="login-layout"
        aria-label="Create a StockPilot workspace"
      >
        <div className="login-context">
          <h1>Create your first workspace.</h1>
          <p>
            Naming the workspace atomically creates the organization, its main
            warehouse, and your Owner membership — all in one transaction.
          </p>
          <ul>
            <li>
              <strong>Owner</strong>
              <span>Full team and billing control</span>
            </li>
            <li>
              <strong>Warehouse</strong>
              <span>One tenant-scoped warehouse per workspace</span>
            </li>
            <li>
              <strong>Isolation</strong>
              <span>PostgreSQL RLS keeps workspaces apart</span>
            </li>
          </ul>
        </div>
        <div className="login-card">
          <div className="login-card-heading">
            <h2>Workspace name</h2>
            <p>You can invite teammates right after creation.</p>
          </div>
          {phase === 'loading' ? (
            <p className="reset-note" aria-live="polite">
              Checking your session…
            </p>
          ) : phase === 'signed-out' ? (
            <p className="form-error" role="alert">
              You need an account first. <a href="/signup">Create one</a> or{' '}
              <a href="/login">sign in</a>.
            </p>
          ) : phase === 'in-workspace' ? null : (
            <>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <form
                className="form-stack"
                onSubmit={(event) => void submit(event)}
              >
                <div className="form-field">
                  <label htmlFor="workspace-name">Workspace name</label>
                  <input
                    autoComplete="organization"
                    id="workspace-name"
                    maxLength={160}
                    minLength={2}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Harbor &amp; Pine Wholesale"
                    required
                    value={name}
                  />
                </div>
                <button
                  className="button button-primary login-submit"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? 'Creating workspace…' : 'Create workspace'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
