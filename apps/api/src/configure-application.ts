import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { parseEnvironment } from './config/environment.js';
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
    .setDescription('Wholesale inventory and order operations API.')
    .setVersion('0.1.0')
    .addCookieAuth(environment.SESSION_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
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
