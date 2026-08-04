import { Inject, Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/node';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { redactRecord } from './redaction.js';

@Injectable()
export class SentryReporter {
  private readonly enabled: boolean;

  constructor(@Inject(ENVIRONMENT) environment: Environment) {
    this.enabled = Boolean(environment.SENTRY_DSN);
    if (this.enabled && environment.SENTRY_DSN) {
      Sentry.init({
        dsn: environment.SENTRY_DSN,
        environment: environment.NODE_ENV,
        tracesSampleRate: 0,
      });
    }
  }

  captureException(exception: unknown, context: Record<string, unknown>): void {
    if (!this.enabled) return;
    Sentry.withScope((scope) => {
      scope.setContext('request', redactRecord(context));
      Sentry.captureException(exception);
    });
  }
}
