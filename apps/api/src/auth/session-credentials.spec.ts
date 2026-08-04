import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

describe('session credentials', () => {
  it('returns a random raw token while exposing only its SHA-256 hash for storage', async () => {
    const { createSessionCredentials } =
      await import('./session-credentials.js');

    const first = createSessionCredentials();
    const second = createSessionCredentials();

    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.tokenHash).toBe(
      createHash('sha256').update(first.rawToken).digest('hex'),
    );
  });

  it('derives and verifies a CSRF token without storing another secret', async () => {
    const { deriveCsrfToken, verifyCsrfToken } =
      await import('./session-credentials.js');
    const sessionHash = 'a'.repeat(64);
    const secret = 'test-csrf-secret-that-is-at-least-32-characters';
    const token = deriveCsrfToken(sessionHash, secret);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyCsrfToken(token, sessionHash, secret)).toBe(true);
    expect(verifyCsrfToken(`${token}x`, sessionHash, secret)).toBe(false);
  });
});
