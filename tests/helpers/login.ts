/**
 * Playwright login helper for AI agent testing.
 *
 * Credentials are read from environment variables — never hardcoded here.
 * Set TEST_ADMIN_NAME and TEST_ADMIN_PASSWORD in .env.local (gitignored).
 *
 * Usage:
 *   import { loginAsAdmin } from './helpers/login';
 *   await loginAsAdmin(page);
 *   await loginAsAdmin(page, '/dashboard/settings');
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

/**
 * Log in as admin and wait until the dashboard has fully loaded (HouseLoader gone,
 * nav sidebar visible). Optionally pass a targetUrl to land on after login.
 *
 * NOTE: Google Sheets data loading can take 30-60s — ensure test timeout is ≥ 120s.
 */
export async function loginAsAdmin(page: Page, targetUrl = '/dashboard'): Promise<void> {
    // Navigate to login, passing callbackUrl so the server redirects us there after auth
    await page.goto(`${BASE_URL}/login?callbackUrl=${encodeURIComponent(targetUrl)}`);
    await page.waitForLoadState('networkidle');

    // Fill credentials — click first to ensure React synthetic events fire in WebKit
    await page.locator('#name').click();
    await page.locator('#name').fill(ADMIN_NAME);
    await page.locator('#password').click();
    await page.locator('#password').fill(ADMIN_PASSWORD);

    // Confirm the submit button is ready
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.waitFor({ state: 'visible' });

    // In Next.js/WebKit, React hydration can miss the first synthetic fill event — refill to be safe
    await page.locator('#name').fill(ADMIN_NAME);
    await page.locator('#password').fill(ADMIN_PASSWORD);

    await submitButton.click();

    // Wait for the browser to land on the dashboard URL (login sets cookie + router.push)
    await page.waitForURL(`${BASE_URL}/dashboard**`, { timeout: 20_000 });

    // Wait for Google Sheets data to load: the HouseLoader ("Wczytywanie danych...") must
    // disappear, meaning settings + employees have been fetched and the layout rendered.
    // This can take 30-60s on first load — that's expected with the Google Sheets backend.
    await page.waitForFunction(
        () => {
            // HouseLoader renders a <p> with "Wczytywanie danych..."
            const loaderParagraph = document.querySelector('p');
            if (!loaderParagraph) return true; // no paragraph = loader not present
            const text = loaderParagraph.textContent || '';
            return !text.includes('Wczytywanie');
        },
        { timeout: 90_000, polling: 1000 }
    );

    // Extra grace for React to finish hydration after data arrives
    await page.waitForTimeout(500);
}

export function recruitmentUrl(): string {
    return `${BASE_URL}/dashboard/recruitment`;
}

export function dashboardUrl(view = 'dashboard'): string {
    return view === 'dashboard' ? `${BASE_URL}/dashboard` : `${BASE_URL}/dashboard/${view}`;
}
