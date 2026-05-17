/**
 * Playwright login helper for AI agent testing.
 *
 * Credentials are read from environment variables — never hardcoded here.
 * Set TEST_ADMIN_NAME and TEST_ADMIN_PASSWORD in .env.local (gitignored).
 *
 * Usage:
 *   import { loginAsAdmin } from './helpers/login';
 *   await loginAsAdmin(page);
 */
import type { Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_NAME = process.env.TEST_ADMIN_NAME || '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

if (!ADMIN_NAME || !ADMIN_PASSWORD) {
    console.warn(
        '[login helper] TEST_ADMIN_NAME or TEST_ADMIN_PASSWORD not set in .env.local — login will fail.'
    );
}

export async function loginAsAdmin(page: Page): Promise<void> {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.locator('#name').fill(ADMIN_NAME);
    await page.locator('#password').fill(ADMIN_PASSWORD);

    await page.locator('button[type="submit"]').waitFor({ state: 'enabled' });
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(`${BASE_URL}/dashboard**`);
    await page.waitForLoadState('networkidle');
}

export function recruitmentUrl(): string {
    return `${BASE_URL}/dashboard?view=recruitment`;
}

export function dashboardUrl(view = 'dashboard'): string {
    return `${BASE_URL}/dashboard?view=${view}`;
}
