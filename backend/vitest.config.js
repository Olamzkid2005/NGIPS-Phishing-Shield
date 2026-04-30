import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['src/**/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/**/__tests__/**', 'src/server.js'],
      // Coverage thresholds for CI enforcement
      // These can be relaxed as the codebase grows
      thresholds: {
        global: {
          branches: 70,
          functions: 60,
          lines: 70,
          statements: 70
        },
        // Per-file thresholds (optional - apply to critical modules)
        './src/routes/analyze.js': {
          branches: 60,
          functions: 80,
          lines: 80,
          statements: 80
        },
        './src/utils/auth.js': {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70
        },
        './src/utils/monitoring.js': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    }
  }
});