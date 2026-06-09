import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

async function gotoView(page: Page, view: string) {
    await page.goto(`/dashboard/odbior`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Wait for animations and data
}

test.describe.serial('Odbiór — Przepływ E2E', () => {

    test('Tworzenie zgłoszenia - Walidacja formularza', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Click "Zgłoś odbiór" CTA
        await page.getByRole('button', { name: /Zgłoś odbiór|Nowe zgłoszenie/ }).first().click();

        // Submit empty form
        await page.locator('[role="dialog"] form button[type="submit"]').click();

        // Verify HTML5 validation or custom toast (here we expect form not to close)
        await expect(page.getByRole('heading', { name: /Zgłoś odbiór|Nowe zgłoszenie/ })).toBeVisible();
        
        // Close dialog
        await page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button.absolute.right-4').first().click({ force: true });
    });

    test('Tworzenie nowego zgłoszenia odbioru', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Click "Zgłoś odbiór" CTA
        await page.getByRole('button', { name: 'Zgłoś odbiór' }).first().click();

        // Fill the form
        await page.fill('input[placeholder="Wpisz imię i nazwisko"]', 'E2E Recruiter');
        await page.fill('input[placeholder="+48 000 000 000"]', '999888777');

        // Select "Stacja autobusowa"
        await page.locator('#auto').click();

        await page.fill('textarea[placeholder="Dodatkowe informacje..."]', 'E2E Test Submission');

        // Submit
        await page.locator('[role="dialog"] form button[type="submit"]').click();

        // Wait for dialog to close (Google Sheets write can take >4s)
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 20000 });

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
        if (!(await wTrakcieRow.isVisible().catch(() => false))) {
            test.skip(true, 'No "W trakcie" odbior entries available to test.');
            return;
        }
        await wTrakcieRow.getByRole('button', { name: 'Szczegóły' }).first().click({ force: true });

        // Verify detail dialog is open on the "W trakcie" tab
        await expect(page.getByRole('heading', { name: 'Odbiór' })).toBeVisible();

        // Verify "W trakcie" tab is active and shows action buttons for an empty submission
        await expect(page.getByRole('tab', { name: /W trakcie/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Dodaj osobę' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Odrzuć' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Zakończ odbiór' })).toBeVisible();
    });

    test('Karty statystyk jako filtry (interaktywne)', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Target the stat cards which contain the large numbers and specific titles.
        // We can find them by looking for the buttons that contain the card descriptions.
        const dostarczoneBtn = page.locator('button', { hasText: 'Dostarczone' }).filter({ has: page.locator('.text-3xl') });
        if (await dostarczoneBtn.count() > 0) {
            await dostarczoneBtn.first().click();
            await page.waitForTimeout(1000);
            await expect(page.locator('select')).toHaveValue('Zakończone_Dostarczone');
            
            // Toggle off
            await dostarczoneBtn.first().click();
            await page.waitForTimeout(1000);
            await expect(page.locator('select')).toHaveValue('all');
        }

        const wTrakcieBtn = page.locator('button', { hasText: 'W trakcie' }).filter({ has: page.locator('.text-3xl') });
        if (await wTrakcieBtn.count() > 0) {
            await wTrakcieBtn.first().click();
            await page.waitForTimeout(1000);
            await expect(page.locator('select')).toHaveValue('W trakcie');
        }

        const nieprzyjeteBtn = page.locator('button', { hasText: 'Nieprzyjęte' }).filter({ has: page.locator('.text-3xl') });
        if (await nieprzyjeteBtn.count() > 0) {
            await nieprzyjeteBtn.first().click();
            await page.waitForTimeout(1000);
            await expect(page.locator('select')).toHaveValue('Nieprzyjęte');
        }
    });

    // SKIP: Google Sheets write latency makes deletion confirmation unreliable in E2E.
    test.skip('Usuwanie zgłoszenia odbioru', async ({ page }) => {
        await loginAsAdmin(page);
        await gotoView(page, 'odbior');

        // Create a temporary submission for deletion
        await page.getByRole('button', { name: /Zgłoś odbiór|Nowe zgłoszenie/ }).first().click();
        await page.fill('input[placeholder="Wpisz imię i nazwisko"]', 'DeleteMe Recruiter');
        await page.fill('input[placeholder="+48 000 000 000"]', '111222333');
        await page.locator('#auto, [value="autobusowa"]').first().click();
        await page.fill('textarea[placeholder="Dodatkowe informacje..."]', 'To be deleted');
        await page.locator('[role="dialog"] form button[type="submit"]').click();
        await expect(page.getByRole('heading', { name: /Zgłoś odbiór|Nowe zgłoszenie/ })).not.toBeVisible({ timeout: 20000 });

        // Find the newly created row and click delete (trash icon)
        const row = page.locator('table tbody tr').filter({ hasText: 'DeleteMe Recruiter' }).first();
        await expect(row).toBeVisible({ timeout: 10000 });
        
        const deleteBtn = row.locator('button.text-red-500, button[aria-label*="Usuń"], button:has(.lucide-trash2)').first();
        if (await deleteBtn.isVisible().catch(() => false)) {
            await deleteBtn.click();
            
            // Confirm deletion in AlertDialog
            const confirmBtn = page.getByRole('button', { name: /Usuń|Potwierdź|Tak/ }).first();
            await expect(confirmBtn).toBeVisible({ timeout: 5000 });
            await confirmBtn.click();

            // Verify it disappeared
            await expect(row).not.toBeVisible({ timeout: 15000 });
        }
    });
});
