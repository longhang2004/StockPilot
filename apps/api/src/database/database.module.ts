import { Module } from '@nestjs/common';

import { EnvironmentModule } from '../config/environment.module.js';
import { PrismaService } from './prisma.service.js';
import { TenantDatabase } from './tenant-database.js';

@Module({
  exports: [PrismaService, TenantDatabase],
  imports: [EnvironmentModule],
  providers: [
    PrismaService,
    {
      inject: [PrismaService],
      provide: TenantDatabase,
      useFactory: (prisma: PrismaService) => new TenantDatabase(prisma),
    },
  ],
})
export class DatabaseModule {}
