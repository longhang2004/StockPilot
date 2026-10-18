'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  ApiProblem,
  apiRequest,
  clearCsrfToken,
  type SessionResponse,
} from '../../lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const session = await apiRequest<SessionResponse>('/auth/login', {
        body: JSON.stringify({ email, password }),
        method: 'POST',
      });
      clearCsrfToken();
      router.replace(session.membership ? '/app' : '/create-workspace');
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiProblem && cause.problem.status === 401
          ? 'Email or password is incorrect. Check your details and try again.'
          : cause instanceof ApiProblem && cause.problem.status === 429
            ? 'Too many sign-in attempts. Wait a moment before trying again.'
            : 'Sign-in is temporarily unavailable. Try again in a moment.',
      );
      setPending(false);
    }
  }

  return (
    <div className="login-card">
      <div className="login-card-heading">
        <h2>Sign in</h2>
        <p>Use your StockPilot account credentials.</p>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="form-field">
          <label htmlFor="login-email">Work email</label>
          <input
            autoComplete="username"
            autoCapitalize="none"
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="form-field">
          <label htmlFor="login-password">Password</label>
          <input
            autoComplete="current-password"
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <button
          className="button button-primary login-submit"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="reset-note">
        Need a workspace? <a href="/signup">Create an account</a>.
      </p>
      <p className="reset-note">
        Exploring StockPilot? <a href="/login?role=manager">Open the demo</a>.
      </p>
    </div>
  );
}
