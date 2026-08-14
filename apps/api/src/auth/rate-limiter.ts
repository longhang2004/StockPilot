/**
 * Fixed-window per-key rate limiter with bounded memory.
 *
 * The guard that uses this is intentionally in-memory: the portfolio
 * deployment is a single API instance and a per-process limiter is the
 * honest trade-off at that scale (see docs/operations.md). This class keeps
 * that simple design from becoming a memory leak:
 *
 * - Lazy per-key expiration: a bucket whose window elapsed is replaced on
 *   the next request for that key (O(1)).
 * - Amortized sweep: every `sweepInterval` consume() calls, expired buckets
 *   are deleted in one O(n) pass, so steady-state per-request cost stays
 *   O(1) and a burst of unique keys cannot accumulate dead entries forever.
 * - Hard cardinality cap: once `maxBuckets` is reached the expired buckets
 *   are swept, and if the map is still full the bucket with the oldest
 *   window is evicted, so memory is bounded even under address spoofing.
 *
 * All time-dependent behavior is driven by an injectable clock so unit
 * tests can simulate window boundaries without waiting.
 */

export interface RateLimiterOptions {
  /** Fixed window length in milliseconds. */
  windowMs: number;
  /** Maximum allowed calls per key per window. */
  maxWrites: number;
  /** Hard cap on the number of tracked buckets. */
  maxBuckets: number;
  /** Run the expired-entry sweep every N consume() calls. */
  sweepInterval: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the current window resets (only meaningful when !allowed). */
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly maxWrites: number;
  private readonly maxBuckets: number;
  private readonly sweepInterval: number;
  private callsSinceSweep = 0;

  constructor(
    private readonly now: () => number,
    options: RateLimiterOptions,
  ) {
    this.windowMs = options.windowMs;
    this.maxWrites = options.maxWrites;
    this.maxBuckets = options.maxBuckets;
    this.sweepInterval = options.sweepInterval;
  }

  /** Number of currently tracked buckets; exposed for tests and health checks. */
  get size(): number {
    return this.buckets.size;
  }

  consume(key: string): RateLimitResult {
    const now = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.track(key, 1, now + this.windowMs);
      this.maybeSweep();
      return { allowed: true, retryAfterMs: 0 };
    }

    if (bucket.count >= this.maxWrites) {
      this.maybeSweep();
      return { allowed: false, retryAfterMs: bucket.resetAt - now };
    }

    bucket.count += 1;
    this.maybeSweep();
    return { allowed: true, retryAfterMs: 0 };
  }

  private maybeSweep(): void {
    this.callsSinceSweep += 1;
    if (this.callsSinceSweep >= this.sweepInterval) {
      this.callsSinceSweep = 0;
      this.sweepExpired();
    }
  }

  private track(key: string, count: number, resetAt: number): void {
    if (this.buckets.has(key)) {
      this.buckets.set(key, { count, resetAt });
      return;
    }

    if (this.buckets.size >= this.maxBuckets) {
      this.sweepExpired();
    }
    if (this.buckets.size >= this.maxBuckets) {
      this.evictOldestWindow();
    }

    this.buckets.set(key, { count, resetAt });
  }

  /** Removes buckets whose window has fully elapsed. O(n), amortized over sweepInterval calls. */
  private sweepExpired(): void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  /** Evicts the bucket whose window resets soonest, keeping the map at capacity. O(n), rare. */
  private evictOldestWindow(): void {
    let oldestKey: string | undefined;
    let oldestResetAt = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt < oldestResetAt) {
        oldestResetAt = bucket.resetAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) {
      this.buckets.delete(oldestKey);
    }
  }
}
