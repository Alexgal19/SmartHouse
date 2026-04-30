import { test, expect, Page } from '@playwright/test';

const ADMIN_NAME = 'admin';
const ADMIN_PASS = 'SWhouse$21';

async function loginAsAdmin(page: Page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('dashboard')) return;
    await page.locator('#name').fill(ADMIN_NAME);
    await page.locator('#password').fill(ADMIN_PASS);
    await page.locator('button:has-text("Zaloguj się")').click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    await page.waitForTimeout(3000);
}

async function gotoView(page: Page, view: string) {
    await page.goto(`/dashboard?view=${view}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Wait for animations and data
}

test.describe('Odbiór — Przepływ E2E', () => {

    test('Tworzenie nowego zgłoszenia odbioru', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Click "Zgłoś odbiór" CTA
        await page.click('button:has-text("Zgłoś odbiór")');

        // Fill the form
        await page.fill('input[placeholder="+48 000 000 000"]', '999888777');
        
        // Select "Stacja autobusowa" (default usually, but let's be sure)
        await page.click('label:has-text("Stacja autobusowa")');
        
        // Increase persons to 3
        await page.click('button:has(svg.lucide-plus)');
        await page.click('button:has(svg.lucide-plus)');
        
        await page.fill('textarea[placeholder="Dodatkowe informacje..."]', 'E2E Test Submission');

        // Submit
        await page.click('button[type="submit"]:has-text("Zgłoś odbiór")');

        // Wait for toast and dialog to close
        await expect(page.locator('text=Zgłoszono odbiór')).toBeVisible();
        await expect(page.locator('h2:has-text("Zgłoś odbiór")')).not.toBeVisible();

        // Verify it appears in the table
        await expect(page.locator('table')).toContainText('Stacja autobusowa');
        await expect(page.locator('table')).toContainText('3');
    });

    test('Otwieranie szczegółów zgłoszenia', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Click the "Eye" icon on the first row
        await page.locator('table tbody tr').first().locator('button:has(svg.lucide-eye)').click();

        // Verify detail dialog is open
        await expect(page.locator('h2:has-text("Szczegóły zgłoszenia")')).toBeVisible();
        
        // Close it
        await page.click('button:has-text("Zamknij")');
    });

    test('Uruchomienie kreatora zakwaterowania z poziomu szczegółów', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Open details
        await page.locator('table tbody tr').first().locator('button:has(svg.lucide-eye)').click();

        // Click "Zakwaterowanie"
        await page.click('button:has-text("Zakwaterowanie")');

        // Verify wizard starts
        await expect(page.locator('h2:has-text("Dane osoby")')).toBeVisible();
        await expect(page.locator('text=Krok 1 z 4')).toBeVisible({ timeout: 5000 });
    });
});
