import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

/**
 * E2E: trwały bufor offline dla zdjęć w kartach kontroli (IndexedDB).
 *
 * Scenariusz krytyczny: zdjęcie dodane bez internetu jest widoczne ze statusem
 * pending, ląduje w IndexedDB i PRZEŻYWA zamknięcie oraz ponowne otwarcie
 * dialogu (rehydratacja) — bez zapisu karty.
 */

// Minimalny poprawny JPEG 1x1 px
const TINY_JPEG = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB' +
    'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64'
);

const countBufferedPhotos = (page: Page): Promise<number> =>
    page.evaluate(() => new Promise<number>((resolve) => {
        const req = indexedDB.open('smarthouse-offline');
        req.onerror = () => resolve(-1);
        req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('pendingPhotos')) { db.close(); resolve(0); return; }
            const countReq = db.transaction('pendingPhotos', 'readonly').objectStore('pendingPhotos').count();
            countReq.onsuccess = () => { db.close(); resolve(countReq.result); };
            countReq.onerror = () => { db.close(); resolve(-1); };
        };
    }));

const clearBufferedPhotos = (page: Page): Promise<void> =>
    page.evaluate(() => new Promise<void>((resolve) => {
        const req = indexedDB.open('smarthouse-offline');
        req.onerror = () => resolve();
        req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('pendingPhotos')) { db.close(); resolve(); return; }
            const clearReq = db.transaction('pendingPhotos', 'readwrite').objectStore('pendingPhotos').clear();
            clearReq.onsuccess = () => { db.close(); resolve(); };
            clearReq.onerror = () => { db.close(); resolve(); };
        };
    }));

test.describe('Karty Kontroli — bufor offline zdjęć', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test.afterEach(async ({ page, context }) => {
        await context.setOffline(false);
        await clearBufferedPhotos(page).catch(() => {});
    });

    test('zdjęcie offline trafia do IndexedDB, pokazuje pending i przeżywa zamknięcie dialogu', async ({ page, context }) => {
        await page.goto(dashboardUrl('control-cards'));
        await page.waitForLoadState('networkidle');

        // Rozwiń pierwszą sekcję miejscowości (nagłówek ma licznik "x/y") i otwórz pierwszy adres
        const sectionHeader = page.getByRole('button').filter({ hasText: /\d\/\d/ }).first();
        if (!(await sectionHeader.isVisible().catch(() => false))) {
            console.log('Brak adresów w widoku kart kontroli — test pominięty.');
            return;
        }
        await sectionHeader.click();
        // Playwright czeka na stabilność elementu, więc animacja akordeonu nie wymaga sleep
        const addressRow = page.locator('button:has(.lucide-chevron-right)').first();
        await expect(addressRow).toBeVisible({ timeout: 10_000 });
        await addressRow.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        const galleryInput = dialog.locator('input[type="file"][multiple]').first();
        if (!(await galleryInput.count())) {
            console.log('Brak widgetu zdjęć (karta tylko do odczytu?) — test pominięty.');
            return;
        }

        // Odetnij sieć i dodaj zdjęcie — upload się nie uda, zdjęcie ląduje w buforze
        await context.setOffline(true);
        await galleryInput.setInputFiles({ name: 'offline-photo.jpg', mimeType: 'image/jpeg', buffer: TINY_JPEG });

        // Status pending (ikona CloudOff na miniaturze)
        await expect(dialog.locator('.lucide-cloud-off').first()).toBeVisible({ timeout: 15_000 });

        // Zdjęcie jest w trwałym buforze IndexedDB
        await expect.poll(() => countBufferedPhotos(page), { timeout: 10_000 }).toBeGreaterThan(0);

        // Zamknij dialog BEZ zapisu — symulacja porzucenia formularza
        const closeButton = dialog.getByRole('button', { name: /close|zamknij/i }).first();
        if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click();
        } else {
            await page.keyboard.press('Escape');
        }
        await expect(dialog).not.toBeVisible({ timeout: 10_000 });

        // Otwórz ponownie ten sam adres — zdjęcie wraca z bufora (rehydratacja)
        await addressRow.click();
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('.lucide-cloud-off').first()).toBeVisible({ timeout: 15_000 });
    });
});
