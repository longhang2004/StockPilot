import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { resolveRequestClientAddress } from './client-address.js';
import { IS_PUBLIC_ROUTE } from './public.decorator.js';
import { FixedWindowRateLimiter } from './rate-limiter.js';

const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL = 256;
const MAX_USER_BUCKETS = 50_000;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Public credential routes get a stricter tier than other public writes. */
const AUTH_ROUTE_PATHS = new Set([
  '/v1/auth/login',
  '/v1/auth/signup',
  '/v1/auth/demo-login',
]);

interface RequestLike {
  get(name: string): string | undefined;
  method: string;
  path?: string;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  setHeader(name: string, value: string): unknown;
}

export interface RateLimitStats {
  buckets: number;
  rejected: {
    public: number;
    auth: number;
    user: number;
  };
  limits: {
    publicWritesPerMinute: number;
    authWritesPerMinute: number;
    userWritesPerMinute: number;
  };
}

/**
 * Three-tier public-write / authenticated-write limiter. The client identity
 * strategy lives in `client-address.ts` and is documented in
 * docs/operations.md: the socket peer is authoritative unless
 * TRUSTED_PROXY_CIDRS is configured AND the peer is inside it, in which case
 * X-Forwarded-For is walked right-to-left to the nearest untrusted hop.
 *
 * Tiers (all fixed 60s windows, all configurable via environment):
 * - auth: public credential routes (login, signup, demo-login), per
 *   (client, route). Default 10/min — the brute-force tripwire per client.
 * - public: other public writes (webhooks), per (client, route).
 *   Default 60/min.
 * - user: every authenticated write, per user across all routes.
 *   Default 240/min — bounds runaway/abusive clients without breaking
 *   normal UI flows.
 *
 * Limitation (documented): the limiter is per process. Behind a reverse
 * proxy every proxied client shares the socket peer, so proxied public
 * writes are capped per route in aggregate; direct callers are capped per
 * IP. Horizontal scaling would need a shared store (Redis), deliberately
 * out of scope for this single-instance deployment.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly authLimiter: FixedWindowRateLimiter;
  private readonly publicLimiter: FixedWindowRateLimiter;
  private readonly userLimiter: FixedWindowRateLimiter;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {
    this.authLimiter = new FixedWindowRateLimiter(() => Date.now(), {
      windowMs: WINDOW_MS,
      maxWrites: environment.RATE_LIMIT_AUTH_WRITES_PER_MIN,
      maxBuckets: MAX_BUCKETS,
      sweepInterval: SWEEP_INTERVAL,
    });
    this.publicLimiter = new FixedWindowRateLimiter(() => Date.now(), {
      windowMs: WINDOW_MS,
      maxWrites: environment.RATE_LIMIT_PUBLIC_WRITES_PER_MIN,
      maxBuckets: MAX_BUCKETS,
      sweepInterval: SWEEP_INTERVAL,
    });
    this.userLimiter = new FixedWindowRateLimiter(() => Date.now(), {
      windowMs: WINDOW_MS,
      maxWrites: environment.RATE_LIMIT_USER_WRITES_PER_MIN,
      maxBuckets: MAX_USER_BUCKETS,
      sweepInterval: SWEEP_INTERVAL,
    });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    const auth = (request as { auth?: { user?: { id: string } } }).auth;
    if (auth?.user) {
      // Authenticated write: per-user tier across all routes. The session
      // guard runs before this one, so request.auth is always populated for
      // protected routes.
      return this.enforce(
        context,
        this.userLimiter,
        `user:${auth.user.id}`,
      );
    }

    if (!isPublic) {
      return true;
    }

    const { address } = resolveRequestClientAddress(request, this.environment);
    const tier = AUTH_ROUTE_PATHS.has(request.path ?? '')
      ? this.authLimiter
      : this.publicLimiter;
    return this.enforce(context, tier, `${address}:${request.path ?? 'public'}`);
  }

  /** Aggregate limiter state for the readiness endpoint and operators. */
  stats(): RateLimitStats {
    return {
      buckets:
        this.authLimiter.size +
        this.publicLimiter.size +
        this.userLimiter.size,
      rejected: {
        public: this.publicLimiter.rejected,
        auth: this.authLimiter.rejected,
        user: this.userLimiter.rejected,
      },
      limits: {
        publicWritesPerMinute: this.environment.RATE_LIMIT_PUBLIC_WRITES_PER_MIN,
        authWritesPerMinute: this.environment.RATE_LIMIT_AUTH_WRITES_PER_MIN,
        userWritesPerMinute: this.environment.RATE_LIMIT_USER_WRITES_PER_MIN,
      },
    };
  }

  private enforce(
    context: ExecutionContext,
    limiter: FixedWindowRateLimiter,
    key: string,
  ): boolean {
    const result = limiter.consume(key);
    if (result.allowed) {
      return true;
    }

    const response = context.switchToHttp().getResponse<ResponseLike>();
    response.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))),
    );
    throw new HttpException(
      'Too many requests. Try again shortly.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
