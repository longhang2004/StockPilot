import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { parseEnvironment } from './config/environment.js';

export function configureApplication(app: INestApplication): void {
  const environment = parseEnvironment(process.env);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1');
  app.enableCors({
    credentials: true,
    origin: environment.WEB_ORIGIN,
  });

  const openApiConfig = new DocumentBuilder()
    .setTitle('StockPilot API')
    .setDescription('Wholesale inventory and order operations API.')
    .setVersion('0.1.0')
    .addCookieAuth(environment.SESSION_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('docs', app, document);
}
