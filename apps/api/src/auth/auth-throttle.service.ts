import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';

interface ThrottleEntry {
  /** Timestamps of failed attempts still inside the counting window. */
  failures: number[];
  /** When set, attempts are rejected until this timestamp. */
  blockedUntil: number | null;
}

const MAX_KEYS = 10_000;
const SWEEP_INTERVAL = 256;

/**
 * Per-account sign-in brute-force throttle.
 *
 * Failed credential attempts are counted per (email, client address) pair.
 * When AUTH_FAILURE_LIMIT failures accumulate inside
 * AUTH_FAILURE_WINDOW_MINUTES, the pair is blocked for AUTH_FAILURE_BLOCK_
 * MINUTES; every blocked attempt is rejected with 429 before any password
 * hash is computed. A successful sign-in clears the counter for that pair.
 *
 * Keying on the pair (not the email alone) means a distributed attacker
 * rotating source addresses cannot lock a victim out of their own account
 * from a different address, while a single-source brute-force run is
 * stopped regardless of which account it targets. Note the documented
 * deployment caveat from docs/operations.md: behind a reverse proxy every
 * browser shares the resolved client address, so in that topology the pair
 * degenerates to per-email throttling — the honest trade-off for
 * per-account protection when the proxy is the only visible peer.
 *
 * Memory is bounded like the rate limiter: lazy expiry, an amortized sweep,
 * and a hard key cap with oldest-entry eviction.
 */
@Injectable()
export class AuthThrottleService {
  private readonly entries = new Map<string, ThrottleEntry>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly blockMs: number;
  private callsSinceSweep = 0;

  /** Injectable clock; tests override it to simulate window boundaries. */
  public now: () => number = Date.now;

  constructor(@Inject(ENVIRONMENT) environment: Environment) {
    this.limit = environment.AUTH_FAILURE_LIMIT;
    this.windowMs = environment.AUTH_FAILURE_WINDOW_MINUTES * 60_000;
    this.blockMs = environment.AUTH_FAILURE_BLOCK_MINUTES * 60_000;
  }

  /** Number of tracked (email, client) pairs; exposed for tests and health. */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Rejects the attempt with 429 when the (email, client) pair is blocked.
   * Call before credential verification so blocked attempts never reach the
   * password hash computation.
   */
  checkAttempt(email: string, clientAddress: string): void {
    const entry = this.entries.get(this.keyFor(email, clientAddress));
    if (entry && entry.blockedUntil !== null) {
      if (entry.blockedUntil > this.now()) {
        throw new HttpException(
          {
            code: 'AUTH_ATTEMPTS_EXCEEDED',
            message: 'Too many failed sign-in attempts. Try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      entry.blockedUntil = null;
    }
  }

  /** Records a failed credential attempt and arms the block at the limit. */
  recordFailure(email: string, clientAddress: string): void {
    const now = this.now();
    const key = this.keyFor(email, clientAddress);
    const entry = this.entries.get(key) ?? { blockedUntil: null, failures: [] };

    entry.failures = entry.failures.filter((at) => at > now - this.windowMs);
    entry.failures.push(now);
    if (
      entry.failures.length >= this.limit &&
      (entry.blockedUntil === null || entry.blockedUntil <= now)
    ) {
      entry.blockedUntil = now + this.blockMs;
    }

    this.track(key, entry);
    this.maybeSweep();
  }

  /** Clears the failure counter after a successful sign-in. */
  clearFailures(email: string, clientAddress: string): void {
    this.entries.delete(this.keyFor(email, clientAddress));
  }

  private keyFor(email: string, clientAddress: string): string {
    return `${email.trim().toLowerCase()}|${clientAddress}`;
  }

  private track(key: string, entry: ThrottleEntry): void {
    if (this.entries.has(key)) {
      this.entries.set(key, entry);
      return;
    }
    if (this.entries.size >= MAX_KEYS) {
      this.sweepExpired();
    }
    if (this.entries.size >= MAX_KEYS) {
      this.evictOldest();
    }
    this.entries.set(key, entry);
  }

  private maybeSweep(): void {
    this.callsSinceSweep += 1;
    if (this.callsSinceSweep >= SWEEP_INTERVAL) {
      this.callsSinceSweep = 0;
      this.sweepExpired();
    }
  }

  /** Drops entries with no live failures and no active block. O(n), amortized. */
  private sweepExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.blockedUntil !== null && entry.blockedUntil > now) {
        continue;
      }
      if (entry.failures.some((at) => at > now - this.windowMs)) {
        continue;
      }
      this.entries.delete(key);
    }
  }

  /** Evicts the entry whose last activity is oldest, keeping the map bounded. */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestActivity = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries) {
      const activity = Math.max(
        entry.blockedUntil ?? 0,
        ...(entry.failures.length > 0 ? entry.failures : [0]),
      );
      if (activity < oldestActivity) {
        oldestActivity = activity;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) {
      this.entries.delete(oldestKey);
    }
  }
}
