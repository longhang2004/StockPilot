import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export interface SessionCredentials {
  rawToken: string;
  tokenHash: string;
}

export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function createSessionCredentials(): SessionCredentials {
  const rawToken = randomBytes(32).toString('base64url');

  return {
    rawToken,
    tokenHash: hashSessionToken(rawToken),
  };
}

export function deriveCsrfToken(
  sessionHash: string,
  csrfSecret: string,
): string {
  return createHmac('sha256', csrfSecret)
    .update(sessionHash)
    .digest('base64url');
}

export function verifyCsrfToken(
  candidate: string,
  sessionHash: string,
  csrfSecret: string,
): boolean {
  const expected = deriveCsrfToken(sessionHash, csrfSecret);
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);

  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}
