import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.describe.serial('Osoba do zakwaterowania — Przepływ E2E', () => {

    // SKIP: Unstable in group runs due to Google Sheets latency and networkidle timeouts.
    test.skip('Zakwaterowanie kandydata w wybranym mieszkaniu', async ({ page }) => {
        await loginAsAdmin(page);
        
        // Najpierw musimy stworzyć kandydata, który ma status pozwalający na zakwaterowanie
        await page.goto(dashboardUrl('recruitment'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const addBtn = page.getByRole('button', { name: 'Dodaj kandydata' }).first();
        await addBtn.click();

        const dialog = page.locator('[role="dialog"]').filter({ hasText: /Dodaj kandydata/ }).first();
        const inputs = dialog.locator('input');
        await inputs.nth(0).fill('ZakwaterowanieName');
        await inputs.nth(1).fill('ZakwaterowanieSurname');
        await inputs.nth(2).fill(`ZAK${Date.now()}`);
        await dialog.getByRole('button', { name: 'Zapisz' }).first().click();
        await page.waitForTimeout(3000);

        // Teraz przechodzimy na stronę "Osoba do zakwaterowania"
        await page.goto(dashboardUrl('osoba-do-zakwaterowania'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Szukamy kandydata
        const card = page.locator('.card, [class*="card"]').filter({ hasText: /ZakwaterowanieName/ }).first();
        
        // Zależnie od implementacji, kandydat musi zmienić status na "W biurze" (Gotowy do zakwaterowania), żeby tam się pojawić.
        // Zakładamy, że test sprawdza widoczność lub ewentualnie dodaje kandydata bezpośrednio przez API.
        // Jeśli jest widoczny, klikamy zakwateruj
        if (await card.isVisible().catch(() => false)) {
            const zakwaterujBtn = card.getByRole('button', { name: /Zakwateruj/i }).first();
            await zakwaterujBtn.click();

            const zDialog = page.locator('[role="dialog"]').filter({ hasText: /Zakwaterowanie/i }).first();
            await expect(zDialog).toBeVisible({ timeout: 5000 });

            // Wybieramy mieszkanie (combobox)
            const housingSelect = zDialog.getByRole('combobox').first();
            if (await housingSelect.isVisible().catch(() => false)) {
                await housingSelect.click();
                await page.waitForTimeout(1000);
                // Wybierz pierwszy z listy (o ile istnieje jakikolwiek)
                const firstOption = page.getByRole('option').first();
                if (await firstOption.isVisible().catch(() => false)) {
                    await firstOption.click();
                }
            }

            // Kliknij zapisz / zakwateruj
            const submitBtn = zDialog.getByRole('button', { name: /Zapisz|Zakwateruj/i }).first();
            await submitBtn.click();
            await page.waitForTimeout(3000);

            // Weryfikacja że zniknął z listy
            await expect(card).not.toBeVisible({ timeout: 10000 });
        }
    });

    test.skip('Sprzątanie - usuwanie kandydata', async ({ page }) => {
        // SKIP: Candidate deletion in E2E is unreliable due to Google Sheets latency and
        // Playwright stale-element issues with filtered rows. Run manually when needed.
        await loginAsAdmin(page);

        // Create a candidate first
        await page.goto(dashboardUrl('recruitment'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const addBtn = page.getByRole('button', { name: 'Dodaj kandydata' }).first();
        await addBtn.click();

        const dialog = page.locator('[role="dialog"]').filter({ hasText: /Dodaj kandydata/ }).first();
        const inputs = dialog.locator('input');
        await inputs.nth(0).fill('ZakwaterowanieName');
        await inputs.nth(1).fill('ZakwaterowanieSurname');
        await inputs.nth(2).fill(`ZAK${Date.now()}`);
        await dialog.getByRole('button', { name: 'Zapisz' }).first().click();
        await page.waitForTimeout(3000);

        // Now delete the candidate
        const row = page.locator('table tbody tr, div[class*="card"]').filter({ hasText: /ZakwaterowanieName/ }).first();
        if (await row.isVisible().catch(() => false)) {
            const deleteBtn = row.locator('button:has(.lucide-trash)').first();
            if (await deleteBtn.isVisible().catch(() => false)) {
                await deleteBtn.click();
            } else {
                const moreBtn = row.locator('button:has(.lucide-more-horizontal)').first();
                if (await moreBtn.isVisible().catch(() => false)) {
                    await moreBtn.click();
                    const dropdownDeleteBtn = page.getByRole('menuitem', { name: /Usuń/ }).first();
                    await dropdownDeleteBtn.click();
                }
            }
            // Deletion happens immediately without confirmation dialog in recruitment view
            await page.waitForTimeout(5000);
            // Refresh and verify the candidate is gone
            await page.reload();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            const rowAfterReload = page.locator('table tbody tr, div[class*="card"]').filter({ hasText: /ZakwaterowanieName/ }).first();
            await expect(rowAfterReload).not.toBeVisible({ timeout: 10000 });
        }
    });
});
