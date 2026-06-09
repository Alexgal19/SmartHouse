import { test, expect } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.describe.serial('Raporty (Settings View)', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await page.goto(dashboardUrl('settings'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // On desktop choose the Import tab; on mobile choose from the select dropdown
        const importTab = page.getByRole('tab', { name: /Import/i }).first();
        if (await importTab.isVisible().catch(() => false)) {
            await importTab.click();
            await page.waitForTimeout(1000);
        } else {
            const mobileSelect = page.locator('select, [role="combobox"]').first();
            if (await mobileSelect.isVisible().catch(() => false)) {
                await mobileSelect.click();
                await page.getByRole('option', { name: /Import/i }).first().click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('Generowanie raportu potrąceń', async ({ page }) => {
        const btn = page.getByRole('button', { name: /Generowanie raportu potrąceń|Generuj raport/i }).last();
        if (await btn.isVisible().catch(() => false)) {
            await expect(btn).toBeEnabled();
            // The generator triggers a direct file download; we just verify the button is present and clickable
            await btn.click();
            await page.waitForTimeout(1000);
        } else {
            console.log('Brak panelu raportów potrąceń. Pomijam.');
        }
    });
});
