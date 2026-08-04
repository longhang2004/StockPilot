import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        'src/auth/rbac.ts': { branches: 80 },
        'src/idempotency/idempotency.ts': { branches: 80 },
        'src/inventory/inventory-projection.ts': { branches: 80 },
        'src/orders/order-state-machine.ts': { branches: 80 },
      },
    },
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
