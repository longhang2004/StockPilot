import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
    },
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
