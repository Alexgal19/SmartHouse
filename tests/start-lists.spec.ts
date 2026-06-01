import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.describe.serial('Start Listy', () => {
    let page: Page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await loginAsAdmin(page);
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('Tworzenie i zapis nowej Start Listy', async () => {
        await page.goto(dashboardUrl('control-cards'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Znajdź pierwszą kartę adresu i kliknij "Szczegóły"
        const cardBtn = page.locator('button').filter({ hasText: 'Szczegóły' }).first();
        if (await cardBtn.isVisible().catch(() => false)) {
            await cardBtn.click();
            await page.waitForTimeout(1000);

            // Przejdź na zakładkę Start List
            const startListTab = page.getByRole('tab', { name: /Start/i }).first();
            await expect(startListTab).toBeVisible();
            await startListTab.click();

            // Uzupełnij przykładowe dane
            await page.fill('input[placeholder="0"]', '123'); // np. licznik

            // Wybierz wifi tak
            const wifiYes = page.locator('button[role="switch"]').first();
            if (await wifiYes.isVisible()) {
                await wifiYes.click();
            }

            // Kliknij zapisz
            const saveBtn = page.getByRole('button', { name: /Zapisz/i }).first();
            await saveBtn.click();

            // Oczekuj na komunikat toast
            await expect(page.locator('text=Zapisano')).toBeVisible({ timeout: 10000 });
        } else {
            console.log('Brak dostępnych adresów do testu Start List.');
        }
    });
});
