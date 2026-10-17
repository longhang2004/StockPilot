import { HttpException } from '@nestjs/common';
import { ZodError } from 'zod';

import { Prisma } from './generated/prisma/client.js';

/**
 * Single source of truth for the HTTP status an exception family produces.
 *
 * Used by BOTH the RFC 9457 ProblemDetailsFilter (which writes the actual
 * response) and the RequestLoggingInterceptor (which records the status in
 * structured logs), so the two can never disagree:
 *
 * - ZodError -> 400 (validation)
 * - Prisma P2002 -> 409 (unique constraint)
 * - Prisma P2025 -> 404 (record not found)
 * - HttpException -> its declared status
 * - anything else -> 500
 */
export function errorStatusCode(exception: unknown): number {
  const parserStatus = bodyParserErrorStatus(exception);
  if (parserStatus) return parserStatus;
  if (exception instanceof ZodError) {
    return 400;
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') return 409;
    if (exception.code === 'P2025') return 404;
    return 500;
  }
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return 500;
}

export function bodyParserErrorStatus(
  exception: unknown,
): 400 | 413 | undefined {
  if (!exception || typeof exception !== 'object' || !('type' in exception)) {
    return undefined;
  }
  if (exception.type === 'entity.too.large') return 413;
  if (exception.type === 'entity.parse.failed') return 400;
  return undefined;
}
