import { randomUUID } from 'node:crypto';

import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from './generated/prisma/client.js';
import { ZodError } from 'zod';
import type { SentryReporter } from './observability/sentry-reporter.js';
import { errorStatusCode } from './problem-status.js';

interface RequestLike {
  get(name: string): string | undefined;
  method?: string;
  originalUrl?: string;
  url?: string;
}

interface ResponseLike {
  json(value: unknown): void;
  setHeader(name: string, value: string): ResponseLike;
  status(code: number): ResponseLike;
}

interface ProblemResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  traceId: string;
  errors?: Array<{ field?: string; message: string }>;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly sentry?: SentryReporter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestLike>();
    const response = context.getResponse<ResponseLike>();
    const traceId = request.get('x-request-id')?.trim() || randomUUID();
    const problem = toProblem(
      exception,
      request.originalUrl || request.url || '/',
      traceId,
    );
    this.sentry?.captureException(exception, {
      method: request.method,
      path: problem.instance,
      traceId,
    });
    response
      .status(problem.status)
      .setHeader('Content-Type', 'application/problem+json')
      .setHeader('X-Trace-Id', traceId)
      .json(problem);
  }
}

function toProblem(
  exception: unknown,
  instance: string,
  traceId: string,
): ProblemResponse {
  if (exception instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      detail: 'One or more request fields are invalid.',
      errors: exception.issues.map((issue) => ({
        ...(issue.path.length > 0 ? { field: issue.path.join('.') } : {}),
        message: issue.message,
      })),
      instance,
      // Status comes from the shared mapping so logs and responses agree.
      status: errorStatusCode(exception),
      title: 'Validation failed',
      traceId,
      type: 'https://stockpilot.dev/problems/validation-error',
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const status = errorStatusCode(exception);
    const code =
      exception.code === 'P2002'
        ? 'CONFLICT'
        : exception.code === 'P2025'
          ? 'NOT_FOUND'
          : 'DATABASE_ERROR';
    return {
      code,
      detail:
        status === 500
          ? 'The request could not be completed.'
          : 'The requested resource conflicts with existing data.',
      instance,
      status,
      title:
        status === 409
          ? 'Conflict'
          : status === 404
            ? 'Not found'
            : 'Database error',
      traceId,
      type: `https://stockpilot.dev/problems/${code.toLowerCase()}`,
    };
  }

  if (exception instanceof HttpException) {
    const status = errorStatusCode(exception);
    const body = exception.getResponse();
    const detail =
      typeof body === 'string'
        ? body
        : typeof body === 'object' && body !== null && 'message' in body
          ? formatMessage(body.message)
          : exception.message;
    const explicitCode =
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string'
        ? body.code
        : null;
    const code =
      explicitCode ??
      (status === 401
        ? 'UNAUTHENTICATED'
        : status === 403
          ? 'FORBIDDEN'
          : status === 404
            ? 'NOT_FOUND'
            : status === 409
              ? 'CONFLICT'
              : 'HTTP_ERROR');
    return {
      code,
      detail,
      instance,
      status,
      title: titleForStatus(status),
      traceId,
      type: `https://stockpilot.dev/problems/${code.toLowerCase()}`,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    detail: 'The request could not be completed.',
    instance,
    status: 500,
    title: 'Internal server error',
    traceId,
    type: 'https://stockpilot.dev/problems/internal-error',
  };
}

function formatMessage(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('; ');
  return typeof value === 'string'
    ? value
    : 'The request could not be completed.';
}

function titleForStatus(status: number): string {
  if (status === 400) return 'Bad request';
  if (status === 401) return 'Authentication required';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not found';
  if (status === 409) return 'Conflict';
  if (status === 429) return 'Too many requests';
  return status >= 500 ? 'Internal server error' : 'Request failed';
}
