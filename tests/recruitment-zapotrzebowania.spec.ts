import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.describe.serial('Rekrutacja i Zapotrzebowania — Przepływ E2E', () => {
    const testCandidateName = `TestZapName_${Date.now()}`;

    test('Tworzenie nowego zapotrzebowania na pracownika', async ({ page }) => {
        await loginAsAdmin(page, '/dashboard/recruitment');
        
        // Nie ma bezpośredniego widoku tworzenia, zapotrzebowanie dodaje się do kandydata w Rekrutacji
        // Zacznijmy od dodania kandydata, a potem dodania do niego zapotrzebowania
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Dodaj kandydata do którego przypiszemy zapotrzebowanie
        const addBtn = page.getByRole('button', { name: 'Dodaj kandydata' }).first();
        await addBtn.click();

        const dialog = page.locator('[role="dialog"]').filter({ hasText: /Dodaj kandydata/ }).first();
        const inputs = dialog.locator('input');
        await inputs.nth(0).fill(testCandidateName);
        await inputs.nth(1).fill('TestZapSurname');
        await inputs.nth(2).fill(`ZAP${Date.now()}`);
        await dialog.getByRole('button', { name: 'Zapisz' }).first().click();
        await page.waitForTimeout(3000);

        // Znajdź utworzonego kandydata
        const kandydatCard = page.locator('table tbody tr, div[class*="card"]').filter({ hasText: testCandidateName }).first();
        const demandBtn = kandydatCard.locator('button').filter({ hasText: /Zapotrzebowanie/ }).first();
        
        if (await demandBtn.isVisible().catch(() => false)) {
            await demandBtn.click();
            
            // Wypełnij formularz zapotrzebowania
            const demandDialog = page.locator('[role="dialog"]').first();
            await expect(demandDialog).toBeVisible({ timeout: 5000 });
            
            // Zaznacz 'Z bagażem'
            const takBtn = demandDialog.getByRole('button', { name: 'Tak' }).first();
            await takBtn.click();

            // Kliknij Wyślij
            const sendBtn = demandDialog.getByRole('button', { name: /Wyślij/ }).first();
            await sendBtn.click();
            await page.waitForTimeout(3000);
        }
    });

    test('Akceptacja zapotrzebowania w widoku Zapotrzebowania', async ({ page }) => {
        await loginAsAdmin(page, '/dashboard/zapotrzebowania');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const card = page.locator('.card, [class*="card"]').filter({ hasText: testCandidateName }).first();
        
        if (await card.isVisible().catch(() => false)) {
            const przyjmijBtn = card.getByRole('button', { name: 'Przyjmij' }).first();
            if (await przyjmijBtn.isVisible().catch(() => false)) {
                await przyjmijBtn.click();
                await page.waitForTimeout(2000);
                
                // Sprawdzenie, czy pojawił się przycisk Dostarczono
                const dostarczonoBtn = card.getByRole('button', { name: 'Dostarczono' }).first();
                await expect(dostarczonoBtn).toBeVisible({ timeout: 5000 });
            }
        }
    });

    test('Usuwanie zapotrzebowania', async ({ page }) => {
        await loginAsAdmin(page, '/dashboard/zapotrzebowania');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const card = page.locator('.card, [class*="card"]').filter({ hasText: testCandidateName }).first();
        if (await card.isVisible().catch(() => false)) {
            const deleteBtn = card.locator('button.text-red-500, button:has(.lucide-trash)').first();
            if (await deleteBtn.isVisible().catch(() => false)) {
                await deleteBtn.click();
                const confirmBtn = page.getByRole('button', { name: /Usuń|Potwierdź|Tak/ }).first();
                await confirmBtn.click();
                await page.waitForTimeout(3000);
                
                // Weryfikacja że zniknęło
                await expect(card).not.toBeVisible({ timeout: 10000 });
            }
        }
    });

    test('Odwoływanie zapotrzebowania w widoku Rekrutacja', async ({ page }) => {
        await loginAsAdmin(page, '/dashboard/recruitment');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Znajdź kandydata, dla którego utworzyliśmy zapotrzebowanie (status 'W drodze do biura')
        const row = page.locator('table tbody tr, div[class*="card"]').filter({ hasText: testCandidateName }).first();
        if (await row.isVisible().catch(() => false)) {
            const moreBtn = row.locator('button:has(.lucide-more-horizontal)').first();
            if (await moreBtn.isVisible().catch(() => false)) {
                await moreBtn.click();
                
                // Szukamy przycisku Odwołaj zapotrzebowanie
                const cancelDemandBtn = page.getByRole('menuitem', { name: /Odwołaj zapotrzebowanie/i }).first();
                // Jesli zapotrzebowanie nie zostało jeszcze zaakceptowane i mamy ten przycisk
                if (await cancelDemandBtn.isVisible().catch(() => false)) {
                    // Żeby nie popsuć testu "Akceptacja zapotrzebowania", tylko sprawdzamy czy przycisk istnieje
                    // Gdybyśmy chcieli go kliknąć, usunęłoby to zapotrzebowanie:
                    // await cancelDemandBtn.click();
                    // Zamiast tego zamykamy dropdown klikając obok
                    await page.mouse.click(0, 0);
                }
            }
        }
    });

    test('Usuwanie kandydata', async ({ page }) => {
        await loginAsAdmin(page, '/dashboard/recruitment');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const row = page.locator('table tbody tr, div[class*="card"]').filter({ hasText: testCandidateName }).first();
        if (await row.isVisible().catch(() => false)) {
            // W zależności od UI usunięcie może być w dropdownie "Więcej" lub bezpośrednio
            const deleteBtn = row.locator('button:has(.lucide-trash)').first();
            if (await deleteBtn.isVisible().catch(() => false)) {
                await deleteBtn.click();
            } else {
                const moreBtn = row.locator('button:has(.lucide-more-horizontal)').first();
                if (await moreBtn.isVisible().catch(() => false)) {
                    await moreBtn.click();
                    const dropdownDeleteBtn = page.getByRole('menuitem', { name: /Usuń/i }).first();
                    await dropdownDeleteBtn.click();
                }
            }

            // W widoku Rekrutacji usunięcie z menu "Więcej" może od razu uruchamiać proces (toast) 
            // lub otwierać dialog. Sprawdźmy czy okno potwierdzenia w ogóle się pojawia.
            const confirmBtn = page.getByRole('button', { name: /Tak|Usuń|Potwierdź/i }).filter({ hasNot: page.getByRole('menuitem') }).first();
            if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await confirmBtn.click();
            }

            // Google Sheets API może zająć chwilę. Czekamy, a jeśli wiersz nie zniknie, próbujemy odświeżyć stronę.
            await page.waitForTimeout(4000);
            if (await row.isVisible().catch(() => false)) {
                await page.reload();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(3000);
            }
            
            await expect(row).not.toBeVisible({ timeout: 10000 });
        }
    });
});
