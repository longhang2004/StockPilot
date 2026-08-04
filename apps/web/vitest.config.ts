import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    hookTimeout: 30_000,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 15_000,
  },
});
