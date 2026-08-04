import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    fileParallelism: false,
    hookTimeout: 30_000,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30_000,
  },
});
