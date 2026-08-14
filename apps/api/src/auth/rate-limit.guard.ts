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
import { resolveClientAddress } from './client-address.js';
import { IS_PUBLIC_ROUTE } from './public.decorator.js';
import { FixedWindowRateLimiter } from './rate-limiter.js';

const WINDOW_MS = 60_000;
const MAX_PUBLIC_WRITES = 60;
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL = 256;

interface RequestLike {
  get(name: string): string | undefined;
  method: string;
  path?: string;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  setHeader(name: string, value: string): unknown;
}

/**
 * Public-write limiter. The client identity strategy lives in
 * `client-address.ts` and is documented in docs/operations.md: the socket
 * peer is authoritative unless TRUSTED_PROXY_CIDRS is configured AND the
 * peer is inside it, in which case X-Forwarded-For is walked right-to-left
 * to the nearest untrusted hop.
 *
 * Limitation (documented): the limiter is per process. Behind a reverse
 * proxy every proxied client shares the socket peer, so public writes are
 * capped per route in aggregate; direct callers are capped per IP.
 * Horizontal scaling would need a shared store (Redis), deliberately out
 * of scope for this single-instance deployment.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter = new FixedWindowRateLimiter(() => Date.now(), {
    windowMs: WINDOW_MS,
    maxWrites: MAX_PUBLIC_WRITES,
    maxBuckets: MAX_BUCKETS,
    sweepInterval: SWEEP_INTERVAL,
  });

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (!isPublic || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const { address } = resolveClientAddress(
      request.socket?.remoteAddress,
      request.get('x-forwarded-for'),
      this.environment.TRUSTED_PROXY_CIDRS,
    );
    const key = `${address}:${request.path ?? 'public'}`;
    const result = this.limiter.consume(key);
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
