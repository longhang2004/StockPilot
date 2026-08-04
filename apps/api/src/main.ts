import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApplication } from './configure-application.js';
import { parseEnvironment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule);
  configureApplication(app);

  await app.listen(environment.PORT);
}

void bootstrap();
