import { test, expect } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.describe('Karty Kontroli - Komentarze i nawigacja', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('powinno dać się przełączać filtry komentarzy na Pulpicie', async ({ page }) => {
        // Idź na dashboard (główny widok)
        await page.goto(dashboardUrl('dashboard'));

        // Oczekujemy, że sekcja się pojawi (zależnie od danych w dev db może nie być komentarzy,
        // ale sprawdzamy czy same przyciski filtrów działają i sekcja się ładuje)
        const commentsPanel = page.locator('text=Komentarze z kart kontroli');
        // If the panel exists, test filters
        if (await commentsPanel.isVisible()) {
            const btnActive = page.getByRole('button', { name: 'Aktywne' });
            const btnAll = page.getByRole('button', { name: 'Wszystkie' });
            
            await expect(btnActive).toBeVisible();
            await expect(btnAll).toBeVisible();

            // Kliknięcie we Wszystkie
            await btnAll.click();
            await expect(btnAll).toHaveClass(/bg-background/); // active class
            await expect(btnActive).not.toHaveClass(/bg-background/);

            // Kliknięcie w Aktywne
            await btnActive.click();
            await expect(btnActive).toHaveClass(/bg-background/);
        }
    });

    test('powinno wspierać deep-linking do konkretnego komentarza', async ({ page }) => {
        // Przechodzimy bezpośrednio na stronę z parametrami, jakbyśmy kliknęli w link na panelu komentarzy
        // Trzeba użyć jakiegoś mockowego addressId i commentId lub poczekać na załadowanie
        // Ponieważ w dev db mogą być różne dane, symulujemy kliknięcie jeśli komentarze są na dashboardzie
        await page.goto(dashboardUrl('dashboard'));

        const firstCommentLink = page.locator('a[href*="/dashboard/control-cards?address="]').first();
        
        if (await firstCommentLink.isVisible()) {
            const href = await firstCommentLink.getAttribute('href');
            expect(href).toContain('&commentId=');

            // Klikamy w zgłoszenie
            await firstCommentLink.click();

            // Sprawdzamy czy URL zmienił się na control-cards
            await page.waitForURL(/\/dashboard\/control-cards\?address=/);

            // Oczekujemy że otworzy się okno dialogowe
            const dialog = page.locator('[role="dialog"]');
            await expect(dialog).toBeVisible();

            // Oczekujemy że zakładka kontroli jest aktywna (np. po panelu z napisem "Oceny pokoi" lub textareas)
            // Czekamy na załadowanie tab contents
            const textarea = page.locator('textarea[id^="comment-"]').first();
            await expect(textarea).toBeVisible();

            // Ponieważ użyliśmy `scrollIntoView` i `focus()` w useEffect z opóźnieniem, sprawdzamy czy pole z id w URL (lub przynajmniej jedno pole) jest sfokusowane po krótkim czasie
            await page.waitForTimeout(500); // 350ms to nasz setTimeout z widoku
            
            // W zależności od commentId pobranego z linku, weryfikacja
            const urlObj = new URL(page.url());
            const commentId = urlObj.searchParams.get('commentId');
            if (commentId) {
                const focusedElement = page.locator(`textarea#comment-${commentId}`);
                await expect(focusedElement).toBeVisible();
                // Sprawdzamy stan focusu - w Playwright to toBeFocused()
                await expect(focusedElement).toBeFocused();
            }
        } else {
            console.log('Brak komentarzy na dashboardzie testowym, test deep-linking pominięty.');
        }
    });
});
