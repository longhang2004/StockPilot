'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { ApiProblem, apiRequest } from '../../../lib/api-client';
import { MarketingArrowLeftIcon } from '../../../components/ui/marketing-icons';

type Phase =
  'loading' | 'no-token' | 'signed-out' | 'accepting' | 'error' | 'done';

const friendlyErrors: Record<string, string> = {
  INVITATION_EXPIRED:
    'This invitation has expired. Ask an Owner to invite you again.',
  INVITATION_REVOKED: 'This invitation was revoked by the workspace Owner.',
  INVITATION_ALREADY_ACCEPTED:
    'This invitation has already been accepted. You are probably already a member.',
  INVITATION_EMAIL_MISMATCH:
    'This invitation was sent to a different email address than the account you are signed in with.',
  INVITATION_NOT_FOUND: 'This invitation link is not valid.',
};

function AcceptInvitationCard({ token }: { token: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/v1/auth/session', { credentials: 'include' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setPhase('signed-out');
          return;
        }
        void accept();
      })
      .catch(() => {
        if (active) setPhase('signed-out');
      });
    return () => {
      active = false;
    };
  }, []);

  const accept = async () => {
    setPhase('accepting');
    try {
      await apiRequest('/team/invitations/accept', {
        body: JSON.stringify({ token }),
        method: 'POST',
      });
      setPhase('done');
      router.push('/app');
      router.refresh();
    } catch (cause) {
      const problem = cause instanceof ApiProblem ? cause : null;
      setDetail(
        (problem && friendlyErrors[problem.code]) ??
          problem?.message ??
          'The invitation could not be accepted.',
      );
      setPhase('error');
    }
  };

  if (phase === 'loading' || phase === 'accepting') {
    return (
      <p className="reset-note" aria-live="polite">
        {phase === 'loading' ? 'Checking your session…' : 'Joining workspace…'}
      </p>
    );
  }
  if (phase === 'no-token') {
    return (
      <p className="form-error" role="alert">
        This invitation link is missing its token. Ask the Owner to share the
        full link again.
      </p>
    );
  }
  if (phase === 'signed-out') {
    return (
      <>
        <p className="form-error" role="alert">
          Sign in or create an account to accept this invitation.
        </p>
        <a className="button button-primary login-submit" href="/login">
          Sign in
        </a>
        <a
          className="button button-secondary login-submit"
          href={`/signup`}
          style={{ marginTop: '0.6rem' }}
        >
          Create an account
        </a>
      </>
    );
  }
  if (phase === 'error') {
    return (
      <>
        <p className="form-error" role="alert">
          {detail}
        </p>
        <a className="button button-secondary login-submit" href="/login">
          Continue to login
        </a>
      </>
    );
  }
  return null;
}

export default function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <main className="login-page">
      <header className="login-header">
        <Link className="brand" href="/" aria-label="Back to StockPilot home">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <span>StockPilot</span>
        </Link>
        <Link className="text-link" href="/">
          <MarketingArrowLeftIcon />
          Back to product overview
        </Link>
      </header>

      <section
        className="login-layout"
        aria-label="Accept a StockPilot invitation"
      >
        <div className="login-context">
          <h1>Join your team&apos;s workspace.</h1>
          <p>
            Accepting creates your membership with the role the Owner chose,
            records the acceptance in the audit trail, and signs you in.
          </p>
          <ul>
            <li>
              <strong>Single use</strong>
              <span>An invitation can be accepted exactly once</span>
            </li>
            <li>
              <strong>Hashed token</strong>
              <span>Only a SHA-256 digest is stored</span>
            </li>
            <li>
              <strong>Expiring</strong>
              <span>Links stop working after seven days</span>
            </li>
          </ul>
        </div>
        <div className="login-card">
          <div className="login-card-heading">
            <h2>Accept invitation</h2>
            <p>Your role and workspace were chosen by the Owner.</p>
          </div>
          <Suspense
            fallback={
              <p className="reset-note" aria-live="polite">
                Checking your session…
              </p>
            }
          >
            <TokenBoundary searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function TokenBoundary({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <p className="form-error" role="alert">
        This invitation link is missing its token. Ask the Owner to share the
        full link again.
      </p>
    );
  }
  return <AcceptInvitationCard token={token} />;
}
