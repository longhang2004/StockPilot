import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { parseEnvironment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule);

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

  await app.listen(environment.PORT);
}

void bootstrap();
