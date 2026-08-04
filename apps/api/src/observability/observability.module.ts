import { Module } from '@nestjs/common';

import { EnvironmentModule } from '../config/environment.module.js';
import { RequestLoggingInterceptor } from './request-logging.interceptor.js';
import { SentryReporter } from './sentry-reporter.js';

@Module({
  imports: [EnvironmentModule],
  providers: [RequestLoggingInterceptor, SentryReporter],
  exports: [RequestLoggingInterceptor, SentryReporter],
})
export class ObservabilityModule {}
