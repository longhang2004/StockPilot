'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiProblem, apiRequest } from '../../lib/api-client';

export function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest('/auth/signup', {
        body: JSON.stringify({ displayName, email, password }),
        method: 'POST',
      });
      router.push('/create-workspace');
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiProblem && cause.code === 'EMAIL_ALREADY_REGISTERED'
          ? 'An account with this email already exists. Sign in instead.'
          : cause instanceof Error
            ? cause.message
            : 'Signup could not be completed.',
      );
      setPending(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-card-heading">
        <h2>Create your account</h2>
        <p>
          You will be signed in immediately, then you can create a workspace and
          become its Owner.
        </p>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="form-field">
          <label htmlFor="signup-name">Full name</label>
          <input
            autoComplete="name"
            id="signup-name"
            maxLength={120}
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </div>
        <div className="form-field">
          <label htmlFor="signup-email">Work email</label>
          <input
            autoComplete="email"
            id="signup-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="form-field">
          <label htmlFor="signup-password">Password</label>
          <input
            autoComplete="new-password"
            id="signup-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <span className="field-hint">At least 8 characters.</span>
        </div>
        <button
          className="button button-primary login-submit"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="reset-note">
        Already have an account? <a href="/login">Sign in</a>.
      </p>
    </div>
  );
}
