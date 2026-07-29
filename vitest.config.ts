import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      exclude: ['src/cli/index.ts'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      reportOnFailure: true,
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
});
