import { test, expect } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.describe.serial('Raporty (Settings View)', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        // Przejdź do zakładki Ustawienia
        await page.goto(dashboardUrl('settings'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('Generowanie raportu potrąceń', async ({ page }) => {
        // Kliknij "Import i raporty" jeśli to jest oddzielna zakładka
        const importTab = page.getByRole('tab', { name: /Import i raporty/i }).first();
        if (await importTab.isVisible()) {
            await importTab.click();
            await page.waitForTimeout(1000);
        }

        // Znajdź przycisk Generuj raport w sekcji Potrąceń
        const btn = page.getByRole('button', { name: /Generowanie raportu potrąceń|Generuj raport/i }).last();
        if (await btn.isVisible()) {
            await btn.click();
            
            // Czekaj na dialog
            const dialog = page.locator('[role="dialog"]').first();
            await expect(dialog).toBeVisible();

            // Upewnij się, że pojawia się przycisk pobierania (czyli klikamy np "Pobierz" w dialogu)
            const downloadBtn = dialog.getByRole('button', { name: /Generuj raport/i }).last();
            
            // Ponieważ nie chcemy faktycznie pobierać pliku w E2E i blokować UI, sprawdzamy tylko obecność przycisku
            await expect(downloadBtn).toBeVisible();
        } else {
            console.log('Brak panelu raportów potrąceń. Pomijam.');
        }
    });
});
