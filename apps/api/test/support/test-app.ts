import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

/**
 * Boots the full application graph exactly like the production entrypoint:
 * the real AppModule, `configureApplication` (helmet, cookies, version
 * prefix, problem-details filter, request logging, Swagger), then `init`.
 * Suites own the resulting app's lifecycle (`app.close()` in afterAll).
 */
export async function createTestApplication(): Promise<{
  app: INestApplication;
}> {
  const [{ AppModule }, { configureApplication }] = await Promise.all([
    import('../../src/app.module.js'),
    import('../../src/configure-application.js'),
  ]);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApplication(app);
  await app.init();
  return { app };
}

/** Admin Prisma client for provisioning/cleaning up suite fixtures. */
export async function createAdminClient(databaseUrl: string) {
  const { createPrismaClient } = await import(
    '../../src/database/prisma-client.js'
  );
  return createPrismaClient(databaseUrl);
}
