import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local for Playwright tests
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
// Override with test-specific values (e.g. SPREADSHEET_ID pointing to a test sheet)
dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true });

export default defineConfig({
  testDir: './tests',
  // Google Sheets API can take 30-60s to respond; allow 120s per test
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Run fewer workers to avoid hitting Google Sheets rate limits
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    headless: !!process.env.CI,
    // Give each action up to 30s (default is 0 = no limit per action)
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // Pass test-specific env vars (e.g. SPREADSHEET_ID) so the dev server
    // writes to the test Google Sheet instead of production data.
    env: {
      SPREADSHEET_ID: process.env.SPREADSHEET_ID ?? '',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
