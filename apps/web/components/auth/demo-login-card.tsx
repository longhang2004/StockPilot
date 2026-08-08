'use client';

import type { Role } from '@stockpilot/contracts';
import { ArrowUpRight } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const roles: ReadonlyArray<{
  description: string;
  label: string;
  value: Role;
}> = [
  {
    description: 'Approve orders, receive stock, and manage the daily queue.',
    label: 'Manager',
    value: 'MANAGER',
  },
  {
    description: 'Prepare drafts and fulfill orders that are ready to ship.',
    label: 'Staff',
    value: 'STAFF',
  },
  {
    description: 'Review organization controls and the complete audit trail.',
    label: 'Owner',
    value: 'OWNER',
  },
];

export function DemoLoginCard({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function startDemo(): Promise<void> {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/demo-login', {
        body: JSON.stringify({ role }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Demo login failed.');
      }

      router.push('/app');
    } catch {
      setError(
        'We could not start the demo. Please try again in a moment or choose another role.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedRole = roles.find(({ value }) => value === role) ?? roles[0];

  return (
    <div className="login-card">
      <div className="login-card-heading">
        <h2>Choose your role</h2>
        <p>
          See how the same wholesale operation changes with each permission
          boundary.
        </p>
      </div>

      <fieldset className="role-picker">
        <legend>Demo role</legend>
        {roles.map((option) => (
          <label
            key={option.value}
            className={`role-option${role === option.value ? ' role-option-selected' : ''}`}
          >
            <input
              checked={role === option.value}
              name="demo-role"
              onChange={() => setRole(option.value)}
              type="radio"
              value={option.value}
            />
            <span className="role-option-copy">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
            <span className="radio-indicator" aria-hidden="true" />
          </label>
        ))}
      </fieldset>

      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}

      <button
        aria-busy={isSubmitting}
        className="button button-primary login-submit"
        disabled={isSubmitting}
        onClick={() => void startDemo()}
        type="button"
      >
        {isSubmitting
          ? 'Starting workspace…'
          : `Continue as ${selectedRole?.label ?? 'Manager'}`}
        <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
      </button>

      <p className="reset-note">
        Demo data resets every six hours. No signup or personal details are
        required.
      </p>
      <p className="reset-note">
        Building something of your own? <a href="/signup">Create a workspace</a>
        .
      </p>
    </div>
  );
}
