import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Playwright config for post-deploy smoke tests against a live environment.
 * Extends base config but disables the local dev-server webServer.
 */
export default defineConfig({
  ...baseConfig,
  testDir: './tests',
  // Only run the regression smoke suite for post-deploy checks
  testMatch: 'smarthouse_regression.spec.ts',
  webServer: undefined,
  use: {
    ...baseConfig.use,
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    headless: true,
  },
  reporter: [['html', { outputFolder: 'playwright-report/smoke' }], ['list']],
});
