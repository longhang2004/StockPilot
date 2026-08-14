import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { catchError, finalize, type Observable, throwError } from 'rxjs';

import { redactRecord } from './redaction.js';
import { errorStatusCode } from '../problem-status.js';

interface RequestLike {
  auth?: {
    membership?: { organization?: { id: string } };
    user?: { id: string };
  };
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  url?: string;
  get(name: string): string | undefined;
}

interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();
    const startedAt = Date.now();
    const traceId = request.get('x-request-id')?.trim() || randomUUID();
    request.headers['x-request-id'] = traceId;
    response.setHeader('X-Trace-Id', traceId);
    let failure: unknown;

    return next.handle().pipe(
      catchError((error: unknown) => {
        failure = error;
        return throwError(() => error);
      }),
      finalize(() => {
        this.logger.log(
          JSON.stringify(
            redactRecord({
              actorId: request.auth?.user?.id ?? null,
              durationMs: Date.now() - startedAt,
              ...(failure
                ? {
                    error:
                      failure instanceof Error
                        ? { message: failure.message, name: failure.name }
                        : failure,
                  }
                : {}),
              headers: request.headers,
              method: request.method,
              organizationId:
                request.auth?.membership?.organization?.id ?? null,
              path: request.originalUrl ?? request.url ?? '/',
              // The exception filter sets the real status only after the
              // interceptor's finalize runs, so the logged status is derived
              // from the error via the same shared mapping the filter uses
              // (ZodError 400, Prisma P2002 409, P2025 404, HttpException
              // declared status, else 500) — logs and responses cannot
              // disagree.
              status: failure ? errorStatusCode(failure) : response.statusCode,
              traceId,
            }),
          ),
        );
      }),
    );
  }
}
