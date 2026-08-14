import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { parseEnvironment } from './config/environment.js';
import { openApiSchemas, schemaRef } from './openapi/schemas.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { RequestLoggingInterceptor } from './observability/request-logging.interceptor.js';
import { SentryReporter } from './observability/sentry-reporter.js';

export function configureApplication(app: INestApplication): void {
  const environment = parseEnvironment(process.env);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1');
  app.enableCors({
    credentials: true,
    origin: environment.WEB_ORIGIN,
  });
  app.useGlobalFilters(new ProblemDetailsFilter(app.get(SentryReporter)));
  app.useGlobalInterceptors(app.get(RequestLoggingInterceptor));

  const openApiConfig = new DocumentBuilder()
    .setTitle('StockPilot API')
    .setDescription(
      'Wholesale inventory and order operations API.\n\n' +
        'Session-based authentication: sign up or log in to receive an ' +
        'HttpOnly session cookie plus a CSRF token in the response body; ' +
        'send the token in the `X-CSRF-Token` header for browser writes. ' +
        'Stock-changing commands (receipts, adjustments, order ' +
        'confirm/fulfill/cancel, import commit, integration retry, demo ' +
        'reset) are idempotent: send an `Idempotency-Key` header and ' +
        'reusing a key with the same payload replays the original response, ' +
        'while a different payload returns 409. Draft order create/update ' +
        'are not idempotent and accept no idempotency key. Errors are ' +
        'returned as RFC 9457 problem details.',
    )
    .setVersion('0.1.0')
    // Stable security-scheme name so protected operations can declare
    // `security: [{ sessionCookie: [] }]`; the cookie name stays
    // environment-configurable.
    .addCookieAuth(
      environment.SESSION_COOKIE_NAME,
      { type: 'apiKey', in: 'cookie', name: environment.SESSION_COOKIE_NAME },
      'sessionCookie',
    )
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);

  // Merge the Zod-derived components into the Nest-generated document and
  // declare the RFC 9457 problem-details shape as the default error body
  // for every operation.
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...(openApiSchemas as Record<
      string,
      NonNullable<typeof document.components.schemas>[string]
    >),
  };
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (
        operation &&
        typeof operation === 'object' &&
        'responses' in operation
      ) {
        const responses = (operation as { responses: Record<string, unknown> })
          .responses;
        responses.default = {
          description:
            'RFC 9457 problem details (validation, authorization, idempotency conflicts, and server errors).',
          content: {
            'application/problem+json': {
              schema: schemaRef('ProblemDetails'),
            },
          },
        };
      }
    }
  }

  SwaggerModule.setup('docs', app, document);
  app
    .getHttpAdapter()
    .getInstance()
    .get(
      '/openapi.json',
      (_request: unknown, response: { json(value: unknown): void }) =>
        response.json(document),
    );
}
