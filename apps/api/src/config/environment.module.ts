import { Module } from '@nestjs/common';

import { parseEnvironment, type Environment } from './environment.js';

export const ENVIRONMENT = Symbol('ENVIRONMENT');

@Module({
  exports: [ENVIRONMENT],
  providers: [
    {
      provide: ENVIRONMENT,
      useFactory: (): Environment => parseEnvironment(process.env),
    },
  ],
})
export class EnvironmentModule {}
