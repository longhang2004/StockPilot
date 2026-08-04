import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.MIGRATION_DATABASE_URL ?? env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
});
