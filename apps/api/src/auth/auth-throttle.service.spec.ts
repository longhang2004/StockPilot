import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { Environment } from '../config/environment.js';
import { AuthThrottleService } from './auth-throttle.service.js';

function createService(
  overrides: Partial<{
    limit: number;
    windowMinutes: number;
    blockMinutes: number;
  }> = {},
): AuthThrottleService {
  const environment = {
    AUTH_FAILURE_BLOCK_MINUTES: overrides.blockMinutes ?? 15,
    AUTH_FAILURE_LIMIT: overrides.limit ?? 3,
    AUTH_FAILURE_WINDOW_MINUTES: overrides.windowMinutes ?? 15,
  } as unknown as Environment;
  return new AuthThrottleService(environment);
}

describe('AuthThrottleService', () => {
  it('allows attempts until the failure limit is reached', () => {
    const service = createService({ limit: 3 });
    const attempt = () => service.checkAttempt('owner@example.com', '1.2.3.4');

    expect(() => attempt()).not.toThrow();
    service.recordFailure('owner@example.com', '1.2.3.4');
    service.recordFailure('owner@example.com', '1.2.3.4');
    expect(() => attempt()).not.toThrow();
    service.recordFailure('owner@example.com', '1.2.3.4');

    let caught: unknown;
    try {
      attempt();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(429);
    expect((caught as HttpException).getResponse()).toMatchObject({
      code: 'AUTH_ATTEMPTS_EXCEEDED',
    });
  });

  it('rejects with a 429 problem-details body while blocked', () => {
    const service = createService({ limit: 1 });
    service.recordFailure('owner@example.com', '1.2.3.4');

    try {
      service.checkAttempt('owner@example.com', '1.2.3.4');
      expect.unreachable('expected a 429 rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toEqual({
        code: 'AUTH_ATTEMPTS_EXCEEDED',
        message: 'Too many failed sign-in attempts. Try again later.',
      });
    }
  });

  it('lifts the block after the block period elapses', () => {
    let now = 1_000;
    const service = createService({ limit: 2, blockMinutes: 15 });
    service.now = () => now;

    service.recordFailure('owner@example.com', '1.2.3.4');
    service.recordFailure('owner@example.com', '1.2.3.4');
    // Block armed at 1_000 for 15 minutes.
    now = 1_000 + 15 * 60_000 - 1;
    expect(() => service.checkAttempt('owner@example.com', '1.2.3.4')).toThrow(
      HttpException,
    );

    now = 1_000 + 15 * 60_000;
    expect(() =>
      service.checkAttempt('owner@example.com', '1.2.3.4'),
    ).not.toThrow();
  });

  it('prunes failures outside the counting window', () => {
    let now = 1_000;
    const service = createService({ limit: 3, windowMinutes: 15 });
    service.now = () => now;

    service.recordFailure('owner@example.com', '1.2.3.4');
    service.recordFailure('owner@example.com', '1.2.3.4');
    // The two failures age out of the 15-minute window…
    now = 1_000 + 15 * 60_000 + 1;
    // …so a third failure no longer crosses the limit.
    service.recordFailure('owner@example.com', '1.2.3.4');
    expect(() =>
      service.checkAttempt('owner@example.com', '1.2.3.4'),
    ).not.toThrow();
  });

  it('clears failures after a successful sign-in', () => {
    const service = createService({ limit: 1 });
    service.recordFailure('owner@example.com', '1.2.3.4');
    service.clearFailures('owner@example.com', '1.2.3.4');

    expect(() =>
      service.checkAttempt('owner@example.com', '1.2.3.4'),
    ).not.toThrow();
  });

  it('keys on the (email, client) pair, normalizing email case', () => {
    const service = createService({ limit: 1 });
    service.recordFailure('Owner@Example.com', '1.2.3.4');

    // Same email (different case) and same client is blocked.
    expect(() => service.checkAttempt('owner@example.com', '1.2.3.4')).toThrow(
      HttpException,
    );
    // A different client address for the same email is not blocked.
    expect(() =>
      service.checkAttempt('owner@example.com', '5.6.7.8'),
    ).not.toThrow();
    // A different email from the blocked client is not blocked.
    expect(() =>
      service.checkAttempt('other@example.com', '1.2.3.4'),
    ).not.toThrow();
  });

  it('keeps memory bounded under key-cardinality abuse', () => {
    const service = createService({ limit: 5 });
    for (let index = 0; index < 11_000; index += 1) {
      service.recordFailure(`user${index}@example.com`, '1.2.3.4');
    }
    expect(service.size).toBeLessThanOrEqual(10_000);
    // The most recent key survives eviction and still throttles normally:
    // four more failures take it to the limit and arm the block.
    for (let index = 0; index < 4; index += 1) {
      service.recordFailure('user10999@example.com', '1.2.3.4');
    }
    expect(() =>
      service.checkAttempt('user10999@example.com', '1.2.3.4'),
    ).toThrow(HttpException);
  });
});
