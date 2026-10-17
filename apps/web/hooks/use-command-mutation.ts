'use client';

import { useMutation } from '@tanstack/react-query';
import { createContext, useContext, useRef, useState } from 'react';

import { ApiProblem, newIdempotencyKey } from '../lib/api-client';

export const CommandIntentScope = createContext<string | null>(null);

// The server retains keys for 24 hours; leave an hour for clock/network skew.
const MAX_RECOVERY_AGE_MS = 23 * 60 * 60 * 1000;
function recoveryExpired(createdAt: number): boolean {
  return (
    Date.now() - createdAt >= MAX_RECOVERY_AGE_MS ||
    createdAt > Date.now() + 5 * 60 * 1000
  );
}

/** Keep the exact submitted payload and key until its outcome is known. */
export function useCommandMutation<TValue, TResult>({
  command,
  prefix,
  validate,
  onSuccess,
  onError,
}: {
  command: (value: TValue, key: string) => Promise<TResult>;
  prefix: string;
  validate: (value: unknown) => value is TValue;
  onSuccess: (result: TResult, value: TValue) => void;
  onError: (error: Error) => void;
}) {
  type Intent = { value: TValue; key: string; createdAt: number };
  const scope = useContext(CommandIntentScope);
  const storageKey = scope
    ? `stockpilot:pending-command:${scope}:${prefix}`
    : null;
  const [restored] = useState<Intent | null>(() => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      const stored: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) ?? 'null',
      );
      if (
        stored &&
        typeof stored === 'object' &&
        'key' in stored &&
        typeof stored.key === 'string' &&
        /^[A-Za-z0-9._:-]{8,255}$/.test(stored.key) &&
        'value' in stored &&
        validate(stored.value)
      ) {
        const createdAt =
          'createdAt' in stored &&
          typeof stored.createdAt === 'number' &&
          Number.isFinite(stored.createdAt)
            ? stored.createdAt
            : 0;
        return { key: stored.key, value: stored.value, createdAt };
      }
      sessionStorage.removeItem(storageKey);
    } catch {
      // Storage can be unavailable; the active component still retains its intent.
    }
    return null;
  });
  const intent = useRef<Intent | null>(restored);
  const inFlight = useRef(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(Boolean(restored));
  const [expired, setExpired] = useState(
    Boolean(restored && recoveryExpired(restored.createdAt)),
  );
  function persist(value: Intent | null, settledKey?: string) {
    if (!storageKey) return;
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else {
        const saved = JSON.parse(
          sessionStorage.getItem(storageKey) ?? 'null',
        ) as { key?: string } | null;
        if (saved?.key === settledKey) sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Preserve the in-memory intent even in browsers that block storage.
    }
  }
  function resolveExpired() {
    if (!intent.current || !recoveryExpired(intent.current.createdAt)) return;
    const key = intent.current.key;
    intent.current = null;
    persist(null, key);
    setOutcomeUnknown(false);
    setExpired(false);
    mutation.reset();
  }
  const mutation = useMutation({
    mutationFn: (submitted: Intent) => command(submitted.value, submitted.key),
    onError: (error: Error, submitted: Intent) => {
      inFlight.current = false;
      const unknown =
        outcomeUnknown ||
        !(error instanceof ApiProblem) ||
        error.problem.status >= 500;
      setOutcomeUnknown(unknown);
      if (!unknown) {
        intent.current = null;
        persist(null, submitted.key);
      }
      onError(error);
    },
    onSuccess: (result: TResult, submitted: Intent) => {
      inFlight.current = false;
      intent.current = null;
      persist(null, submitted.key);
      setOutcomeUnknown(false);
      setExpired(false);
      onSuccess(result, submitted.value);
    },
  });
  return {
    ...mutation,
    variables: mutation.variables?.value ?? restored?.value,
    restoredValue: restored?.value,
    idempotencyKey:
      intent.current?.key ?? (outcomeUnknown ? restored?.key : undefined),
    mutate: (value: TValue) => {
      if (inFlight.current) return;
      intent.current ??= {
        value: structuredClone(value),
        key: newIdempotencyKey(prefix),
        createdAt: Date.now(),
      };
      if (recoveryExpired(intent.current.createdAt)) {
        setExpired(true);
        setOutcomeUnknown(true);
        return;
      }
      persist(intent.current);
      inFlight.current = true;
      mutation.mutate(intent.current);
    },
    outcomeUnknown,
    recoveryExpired: expired,
    resolveExpired,
    recoveryMessage: expired
      ? 'The saved request is outside the safe retry window. Verify the original outcome in the ledger or audit history before taking further action. Automatic replay is blocked to prevent duplicate changes.'
      : 'The result is not confirmed. Values are locked. Retry the saved request to recover its result safely; closing keeps this pending request.',
    locked: mutation.isPending || outcomeUnknown,
  };
}
