import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApplication } from './configure-application.js';
import { parseEnvironment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const environment = parseEnvironment(process.env);
  // rawBody preserves the untouched payload for Stripe webhook signatures.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureApplication(app);
  app.enableShutdownHooks();

  await app.listen(environment.PORT, '0.0.0.0');
}

void bootstrap();
