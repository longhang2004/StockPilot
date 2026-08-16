import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../config/environment.js';
import { RateLimitGuard } from './rate-limit.guard.js';

function createGuard(
  overrides: Partial<{
    publicWritesPerMinute: number;
    authWritesPerMinute: number;
    userWritesPerMinute: number;
  }> = {},
  isPublic: () => boolean = () => false,
): RateLimitGuard {
  const environment = {
    RATE_LIMIT_AUTH_WRITES_PER_MIN: overrides.authWritesPerMinute ?? 60,
    RATE_LIMIT_PUBLIC_WRITES_PER_MIN: overrides.publicWritesPerMinute ?? 60,
    RATE_LIMIT_USER_WRITES_PER_MIN: overrides.userWritesPerMinute ?? 240,
    TRUSTED_PROXY_CIDRS: undefined,
  } as unknown as Environment;
  const reflector = { getAllAndOverride: () => isPublic() };
  return new RateLimitGuard(reflector as never, environment);
}

function createContext(request: {
  auth?: { user?: { id: string } };
  get(name: string): string | undefined;
  method: string;
  path?: string;
  socket?: { remoteAddress?: string };
}): ExecutionContext {
  const headers: Record<string, string> = {};
  request.get = (name: string) => headers[name.toLowerCase()];
  const response = { setHeader: vi.fn() };
  return {
    getClass: () => ({}),
    getHandler: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function expectTooManyRequests(
  guard: RateLimitGuard,
  context: ExecutionContext,
): void {
  let caught: unknown;
  try {
    guard.canActivate(context);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getStatus()).toBe(429);
  const response = context.switchToHttp().getResponse() as {
    setHeader: ReturnType<typeof vi.fn>;
  };
  expect(response.setHeader).toHaveBeenCalledWith(
    'Retry-After',
    expect.any(String),
  );
}

describe('RateLimitGuard', () => {
  it('skips safe methods entirely without creating buckets', () => {
    const guard = createGuard({}, () => true);
    for (let index = 0; index < 1_000; index += 1) {
      expect(
        guard.canActivate(
          createContext({
            get: () => undefined,
            method: 'GET',
            path: '/v1/auth/login',
            socket: { remoteAddress: '1.2.3.4' },
          }),
        ),
      ).toBe(true);
    }
    expect(guard.stats().buckets).toBe(0);
  });

  it('applies the stricter auth tier to credential routes', () => {
    const guard = createGuard({ authWritesPerMinute: 10 }, () => true);
    const client = '1.2.3.4';

    for (let index = 0; index < 10; index += 1) {
      expect(
        guard.canActivate(
          createContext({
            get: () => undefined,
            method: 'POST',
            path: '/v1/auth/login',
            socket: { remoteAddress: client },
          }),
        ),
      ).toBe(true);
    }
    expectTooManyRequests(
      guard,
      createContext({
        get: () => undefined,
        method: 'POST',
        path: '/v1/auth/login',
        socket: { remoteAddress: client },
      }),
    );
    expect(guard.stats().rejected.auth).toBe(1);
  });

  it('keeps the auth tier per client and per route', () => {
    const guard = createGuard({ authWritesPerMinute: 3 }, () => true);
    const exhausted = (path: string, client: string) =>
      createContext({
        get: () => undefined,
        method: 'POST',
        path,
        socket: { remoteAddress: client },
      });

    guard.canActivate(exhausted('/v1/auth/login', '1.2.3.4'));
    guard.canActivate(exhausted('/v1/auth/login', '1.2.3.4'));
    guard.canActivate(exhausted('/v1/auth/login', '1.2.3.4'));
    expectTooManyRequests(guard, exhausted('/v1/auth/login', '1.2.3.4'));

    // A different client address has its own budget.
    expect(guard.canActivate(exhausted('/v1/auth/login', '5.6.7.8'))).toBe(
      true,
    );
    // A different auth route has its own budget.
    expect(guard.canActivate(exhausted('/v1/auth/signup', '1.2.3.4'))).toBe(
      true,
    );
  });

  it('applies the looser public tier to non-auth public writes', () => {
    const guard = createGuard({ publicWritesPerMinute: 3 }, () => true);
    const webhook = (client: string) =>
      createContext({
        get: () => undefined,
        method: 'POST',
        path: '/v1/webhooks/mock-storefront/orders',
        socket: { remoteAddress: client },
      });

    guard.canActivate(webhook('1.2.3.4'));
    guard.canActivate(webhook('1.2.3.4'));
    guard.canActivate(webhook('1.2.3.4'));
    expectTooManyRequests(guard, webhook('1.2.3.4'));
    expect(guard.stats().rejected.public).toBe(1);
    // The auth tier is untouched by public-tier traffic.
    expect(guard.stats().rejected.auth).toBe(0);
  });

  it('limits authenticated writes per user across all routes', () => {
    const guard = createGuard({ userWritesPerMinute: 3 });
    const write = (userId: string, path: string) =>
      createContext({
        auth: { user: { id: userId } },
        get: () => undefined,
        method: 'POST',
        path,
        socket: { remoteAddress: '9.9.9.9' },
      });

    expect(guard.canActivate(write('u1', '/v1/orders'))).toBe(true);
    expect(guard.canActivate(write('u1', '/v1/orders'))).toBe(true);
    expect(guard.canActivate(write('u1', '/v1/products'))).toBe(true);
    // The budget is per user, not per route.
    expectTooManyRequests(guard, write('u1', '/v1/orders'));
    expect(guard.stats().rejected.user).toBe(1);

    // A different user has their own budget.
    expect(guard.canActivate(write('u2', '/v1/orders'))).toBe(true);
  });

  it('keeps authenticated writes off the public tiers', () => {
    let isPublic = true;
    const guard = createGuard(
      { publicWritesPerMinute: 3, userWritesPerMinute: 100 },
      () => isPublic,
    );
    const publicWrite = (client: string) =>
      createContext({
        get: () => undefined,
        method: 'POST',
        path: '/v1/webhooks/mock-storefront/orders',
        socket: { remoteAddress: client },
      });

    // Exhaust the public tier for this client…
    for (let index = 0; index < 3; index += 1) {
      guard.canActivate(publicWrite('1.2.3.4'));
    }
    // …then authenticated writes from the same client still pass (user tier),
    // and they are counted on the user tier, not the public tier.
    isPublic = false;
    expect(
      guard.canActivate(
        createContext({
          auth: { user: { id: 'u1' } },
          get: () => undefined,
          method: 'POST',
          path: '/v1/orders',
          socket: { remoteAddress: '1.2.3.4' },
        }),
      ),
    ).toBe(true);
    expect(guard.stats().rejected.user).toBe(0);
    expect(guard.stats().rejected.public).toBe(0);
  });

  it('reports aggregate stats for the readiness endpoint', () => {
    const guard = createGuard();
    expect(guard.stats()).toEqual({
      buckets: 0,
      rejected: { public: 0, auth: 0, user: 0 },
      limits: {
        publicWritesPerMinute: 60,
        authWritesPerMinute: 60,
        userWritesPerMinute: 240,
      },
    });
  });
});
