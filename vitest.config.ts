import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/types/**',
        '*.config.{ts,js,mjs}',
      ],
      // Required thresholds - build fails if not met
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      include: ['src/**/*.{ts,tsx}'],
    },
    // Only re-run tests for changed files
    cache: {
      dir: './node_modules/.vitest',
    },
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  // Watch mode configuration - exclude files from triggering re-runs
  server: {
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/coverage/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
