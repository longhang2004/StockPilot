import { Module } from '@nestjs/common';

import { EnvironmentModule } from '../config/environment.module.js';
import { JobRunnerService } from './job-runner.service.js';

@Module({
  exports: [JobRunnerService],
  imports: [EnvironmentModule],
  providers: [JobRunnerService],
})
export class JobsModule {}
