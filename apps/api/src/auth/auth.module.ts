import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DemoModule } from '../demo/demo.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { PermissionGuard } from './permission.guard.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { SessionGuard } from './session.guard.js';

@Module({
  controllers: [AuthController],
  exports: [AuthService, RateLimitGuard],
  imports: [EnvironmentModule, DatabaseModule, DemoModule],
  providers: [
    AuthService,
    AuthThrottleService,
    RateLimitGuard,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AuthModule {}
