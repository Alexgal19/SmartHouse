import { test, expect, Page } from '@playwright/test';

const ADMIN_NAME = 'admin';
const ADMIN_PASS = 'SWhouse$21';

async function loginAsAdmin(page: Page) {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    if (page.url().includes('dashboard')) return;
    await page.locator('#name').fill(ADMIN_NAME);
    await page.locator('#password').fill(ADMIN_PASS);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    await page.waitForTimeout(3000);
}

async function gotoView(page: Page, view: string) {
    await page.goto(`/dashboard?view=${view}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Wait for animations and data
}

test.describe.serial('Odbiór — Przepływ E2E', () => {

    test('Tworzenie nowego zgłoszenia odbioru', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Click "Zgłoś odbiór" CTA
        await page.getByRole('button', { name: 'Zgłoś odbiór' }).first().click();

        // Fill the form
        await page.fill('input[placeholder="+48 000 000 000"]', '999888777');

        // Select "Stacja autobusowa"
        await page.locator('#auto').click();

        await page.fill('textarea[placeholder="Dodatkowe informacje..."]', 'E2E Test Submission');

        // Submit
        await page.locator('[role="dialog"] form button[type="submit"]').click();

        // Wait for dialog to close (Google Sheets write can take >4s)
        await expect(page.getByRole('heading', { name: 'Zgłoś odbiór' })).not.toBeVisible({ timeout: 20000 });

        // Verify it appears in the table (default persons=1)
        await expect(page.getByRole('table')).toContainText('autobusowa', { timeout: 10000 });
        await expect(page.getByRole('table')).toContainText('1', { timeout: 10000 });
    });

    test('Otwieranie szczegółów zgłoszenia', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Click the "Szczegóły" button on the first row
        await page.getByRole('button', { name: 'Szczegóły' }).first().click({ force: true });

        // Verify detail dialog is open
        await expect(page.getByRole('heading', { name: 'Odbiór' })).toBeVisible();

        // Close it (default Dialog X button)
        await page.getByRole('button', { name: 'Close' }).click();
    });

    test('Szczegóły zgłoszenia — widok W trakcie z akcjami', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Find first row with "W trakcie" status and open its details
        const wTrakcieRow = page.locator('table tbody tr').filter({ hasText: 'W trakcie' }).first();
        await wTrakcieRow.locator('button[aria-label="Szczegóły"]').click({ force: true });

        // Verify detail dialog is open on the "W trakcie" tab
        await expect(page.getByRole('heading', { name: 'Odbiór' })).toBeVisible();

        // Verify "W trakcie" tab is active and shows action buttons
        await expect(page.getByRole('tab', { name: /W trakcie/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Zakwaterowanie' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Badania' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Rozmowa rekrutacyjna' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Zakończ odbiór' })).toBeVisible();
    });
});
