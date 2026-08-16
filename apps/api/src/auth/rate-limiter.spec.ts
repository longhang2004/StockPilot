import { describe, expect, it } from 'vitest';

import { FixedWindowRateLimiter } from './rate-limiter.js';

function createLimiter(
  now: () => number,
  overrides: Partial<{
    windowMs: number;
    maxWrites: number;
    maxBuckets: number;
    sweepInterval: number;
  }> = {},
) {
  return new FixedWindowRateLimiter(now, {
    windowMs: 60_000,
    maxWrites: 3,
    maxBuckets: 5,
    sweepInterval: 4,
    ...overrides,
  });
}

describe('FixedWindowRateLimiter', () => {
  it('allows requests up to the window limit and rejects the next', () => {
    const now = 1_000;
    const limiter = createLimiter(() => now);

    expect(limiter.consume('ip:/v1/auth/signup').allowed).toBe(true);
    expect(limiter.consume('ip:/v1/auth/signup').allowed).toBe(true);
    expect(limiter.consume('ip:/v1/auth/signup').allowed).toBe(true);
    const rejected = limiter.consume('ip:/v1/auth/signup');
    expect(rejected.allowed).toBe(false);
    // The window opened at the first request, so it resets a full window
    // from that moment.
    expect(rejected.retryAfterMs).toBe(60_000);
    expect(limiter.rejected).toBe(1);
    expect(limiter.consume('ip:/v1/auth/signup').allowed).toBe(false);
    expect(limiter.rejected).toBe(2);
  });

  it('opens a fresh window after the fixed window elapses', () => {
    let now = 1_000;
    const limiter = createLimiter(() => now);
    limiter.consume('k');
    limiter.consume('k');
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);

    now = 1_000 + 60_000;
    expect(limiter.consume('k').allowed).toBe(true);
  });

  it('keeps route-specific buckets independent', () => {
    const limiter = createLimiter(() => 1_000);
    limiter.consume('ip:/v1/auth/signup');
    limiter.consume('ip:/v1/auth/signup');
    limiter.consume('ip:/v1/auth/signup');
    expect(limiter.consume('ip:/v1/auth/signup').allowed).toBe(false);
    expect(
      limiter.consume('ip:/v1/webhooks/mock-storefront/orders').allowed,
    ).toBe(true);
  });

  it('keeps different client addresses independent', () => {
    const limiter = createLimiter(() => 1_000);
    limiter.consume('1.2.3.4:/v1/auth/signup');
    limiter.consume('1.2.3.4:/v1/auth/signup');
    limiter.consume('1.2.3.4:/v1/auth/signup');
    expect(limiter.consume('1.2.3.4:/v1/auth/signup').allowed).toBe(false);
    expect(limiter.consume('5.6.7.8:/v1/auth/signup').allowed).toBe(true);
  });

  it('evicts expired buckets on the amortized sweep', () => {
    let now = 1_000;
    const limiter = createLimiter(() => now);
    // Fill the map with distinct keys whose windows expire at 61_000.
    for (let index = 0; index < 5; index += 1) {
      expect(limiter.consume(`k${index}`).allowed).toBe(true);
    }
    expect(limiter.size).toBe(5);

    // Advance past the window and trigger the sweep with a new key. The
    // sweep runs every sweepInterval calls (here 4).
    now = 62_000;
    limiter.consume('k0');
    limiter.consume('k0');
    limiter.consume('k0');
    limiter.consume('k0');
    expect(limiter.size).toBe(1);
  });

  it('never exceeds maxBuckets under cardinality abuse', () => {
    const now = 1_000;
    const limiter = createLimiter(() => now);
    for (let index = 0; index < 1_000; index += 1) {
      limiter.consume(`spoofed-${index}`);
    }
    expect(limiter.size).toBeLessThanOrEqual(5);
    // The most recent key must still be tracked.
    expect(limiter.consume('spoofed-999').allowed).toBe(true);
  });

  it('evicts the oldest window when the map is full of live buckets', () => {
    const now = 1_000;
    const limiter = createLimiter(() => now);
    for (let index = 0; index < 5; index += 1) {
      limiter.consume(`live-${index}`);
    }
    // All five buckets are live; a sixth distinct key must evict the oldest
    // window (live-0) while keeping the newest five.
    expect(limiter.consume('live-5').allowed).toBe(true);
    expect(limiter.size).toBe(5);
    // The evicted key starts a fresh bucket instead of being rejected.
    expect(limiter.consume('live-0').allowed).toBe(true);
  });

  it('is a no-op for expired buckets on first touch (lazy replacement)', () => {
    let now = 1_000;
    const limiter = createLimiter(() => now);
    limiter.consume('k');
    limiter.consume('k');
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);
    now = 61_001;
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.size).toBe(1);
  });
});
