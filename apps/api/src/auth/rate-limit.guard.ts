import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_ROUTE } from './public.decorator.js';

const WINDOW_MS = 60_000;
const MAX_PUBLIC_WRITES = 60;

interface RequestLike {
  get(name: string): string | undefined;
  method: string;
  path?: string;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (!isPublic || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const now = Date.now();
    const address =
      request.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `${address}:${request.path ?? 'public'}`;
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }
    if (bucket.count >= MAX_PUBLIC_WRITES) {
      throw new HttpException('Too many requests. Try again shortly.', 429);
    }
    bucket.count += 1;
    return true;
  }
}
