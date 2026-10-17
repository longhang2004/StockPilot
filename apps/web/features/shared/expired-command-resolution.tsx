'use client';

export function ExpiredCommandResolution({
  idempotencyKey,
  onResolve,
}: {
  idempotencyKey: string | undefined;
  onResolve: () => void;
}) {
  return (
    <div className="form-stack">
      <p>
        Request key: <code>{idempotencyKey ?? 'unavailable'}</code>. Check the
        relevant ledger or audit history for this request before continuing.
      </p>
      <button
        className="button button-secondary"
        onClick={() => {
          if (
            window.confirm(
              'Have you verified this request’s outcome in the ledger or audit history? This clears the saved request without replaying it.',
            )
          )
            onResolve();
        }}
        type="button"
      >
        I verified the outcome
      </button>
    </div>
  );
}
