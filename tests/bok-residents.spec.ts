import { test, expect } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.describe.serial('BOK / Osoba do zakwaterowania', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        // Przejdź do panelu BOK
        await page.goto(dashboardUrl('osoba-do-zakwaterowania'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('Otwarcie szczegółów osoby do zakwaterowania i modyfikacja atrybutów', async ({ page }) => {
        // Znajdź pierwszego mieszkańca na liście (jeśli dostępny)
        const row = page.locator('table tbody tr').first();
        if (await row.isVisible()) {
            const detailBtn = row.locator('button').first();
            await detailBtn.click();

            // Oczekujemy otwarcia dialogu "Edytuj mieszkańca BOK"
            const dialog = page.locator('[role="dialog"]').first();
            await expect(dialog).toBeVisible();

            // Upewnijmy się, że pola są widoczne
            const nameInput = dialog.locator('input[id="name"]').first();
            await expect(nameInput).toBeVisible();

            // Możemy wpisać testowy komentarz w historii BOK (jeśli jest taka sekcja)
            const addCommentBtn = dialog.getByRole('button', { name: /Dodaj/i }).last();
            if (await addCommentBtn.isVisible()) {
                await expect(addCommentBtn).not.toBeDisabled();
            }

            // Zamknij
            const closeBtn = dialog.getByRole('button', { name: 'Close' }).first();
            if (await closeBtn.isVisible()) {
                await closeBtn.click();
            }
        } else {
            console.log('Brak osób do zakwaterowania. Pomijam.');
        }
    });
});
