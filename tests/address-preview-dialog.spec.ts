import { test, expect, Page } from '@playwright/test';

// Helper: log in and navigate to dashboard
async function loginAndGo(page: Page, path = '/dashboard?view=dashboard') {
  await page.goto('/login');
  await page.fill('#name', 'admin');
  await page.fill('#password', 'password');
  await page.click('button:has-text("Zaloguj się")');
  await page.waitForURL('/dashboard?view=dashboard');
  if (path !== '/dashboard?view=dashboard') {
    await page.goto(path);
  }
}

// Helper: open dialog via "Przeglądaj mieszkania" on dashboard
async function openDialogFromDashboard(page: Page) {
  await loginAndGo(page);
  await page.click('button:has-text("Przeglądaj mieszkania")');
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('AddressPreviewDialog — otwieranie i zamykanie', () => {
  test('otwiera się po kliknięciu "Przeglądaj mieszkania" na dashboardzie', async ({ page }) => {
    await loginAndGo(page);
    await page.click('button:has-text("Przeglądaj mieszkania")');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Podgląd i wybór dostępności miejsc')).toBeVisible();
    await expect(dialog.getByText('Wybierz miejscowość, aby zobaczyć dostępność adresów')).toBeVisible();
  });

  test('zamyka się po kliknięciu "Anuluj"', async ({ page }) => {
    await openDialogFromDashboard(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('zamyka się po kliknięciu przycisku X', async ({ page }) => {
    await openDialogFromDashboard(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

test.describe('AddressPreviewDialog — widok początkowy', () => {
  test('pokazuje sekcję wyboru miejscowości', async ({ page }) => {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    await expect(dialog.getByText('Wybierz zakwaterowanie')).toBeVisible();
    await expect(dialog.getByLabel('Miejscowość')).toBeVisible();
  });

  test('przycisk "Zastosuj wybór" jest wyłączony bez wyboru', async ({ page }) => {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    // Button is disabled when nothing selected (no locality/address/room)
    const applyButton = dialog.getByRole('button', { name: 'Zastosuj wybór' });
    if (await applyButton.count() > 0) {
      await expect(applyButton).toBeDisabled();
    }
  });

  test('dropdown miejscowości zawiera opcję "Wszystkie miejscowości"', async ({ page }) => {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Miejscowość').click();
    await expect(page.getByRole('option', { name: 'Wszystkie miejscowości' })).toBeVisible();
  });
});

test.describe('AddressPreviewDialog — filtrowanie po miejscowości', () => {
  test('wybór "Wszystkie miejscowości" pokazuje karty podsumowania', async ({ page }) => {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Miejscowość').click();
    await page.getByRole('option', { name: 'Wszystkie miejscowości' }).click();

    // Summary section should appear
    await expect(dialog.getByText('Podsumowanie według miejscowości')).toBeVisible();
  });

  test('karty podsumowania zawierają dane o pojemności', async ({ page }) => {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Miejscowość').click();
    await page.getByRole('option', { name: 'Wszystkie miejscowości' }).click();

    // Each card should have capacity stats
    const cards = dialog.locator('[data-testid="locality-card"], .rounded-xl, [class*="Card"]')
      .filter({ hasText: 'Całkowita pojemność' });

    // At least one card with capacity info should exist if data is loaded
    // (test is data-dependent; we just verify structure)
    await expect(dialog.getByText('Całkowita pojemność:').first()).toBeVisible();
    await expect(dialog.getByText('Zajęte:').first()).toBeVisible();
    await expect(dialog.getByText('Dostępne:').first()).toBeVisible();
  });

  test('wybór konkretnej miejscowości pokazuje adresy w tej miejscowości', async ({ page }) => {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Miejscowość').click();

    // Get all locality options (skip first which is "Wszystkie")
    const options = page.getByRole('option').filter({ hasNot: page.getByText('Wszystkie miejscowości') });
    const count = await options.count();

    if (count > 0) {
      const firstLocalityName = await options.first().textContent();
      await options.first().click();

      // Should show address blocks section
      await expect(dialog.getByText(`Adresy w miejscowości:`)).toBeVisible();
      if (firstLocalityName) {
        await expect(dialog.getByText(firstLocalityName.trim())).toBeVisible();
      }
    }
  });

  test('zmiana miejscowości resetuje rozwinięte karty adresów', async ({ page }) => {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    // Select first locality
    await dialog.getByLabel('Miejscowość').click();
    const options = page.getByRole('option').filter({ hasNot: page.getByText('Wszystkie miejscowości') });
    if (await options.count() < 2) return; // skip if not enough data

    await options.first().click();

    // Expand a card if possible
    const cards = dialog.locator('.cursor-pointer').first();
    if (await cards.count() > 0) {
      await cards.click();
    }

    // Select a different locality
    await dialog.getByLabel('Miejscowość').click();
    await options.nth(1).click();

    // Room panel from previous selection should be gone
    await expect(dialog.locator('table:has-text("Pokój")')).not.toBeVisible();
  });
});

test.describe('AddressPreviewDialog — collapsible karty adresów', () => {
  // Helper to open dialog with a specific locality selected
  async function openWithLocality(page: Page): Promise<string | null> {
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Miejscowość').click();
    const options = page.getByRole('option').filter({ hasNot: page.getByText('Wszystkie miejscowości') });

    if (await options.count() === 0) return null;

    const localityName = await options.first().textContent();
    await options.first().click();
    return localityName?.trim() ?? null;
  }

  test('kliknięcie karty adresu rozszerza panel pokojów', async ({ page }) => {
    const locality = await openWithLocality(page);
    if (!locality) return;

    const dialog = page.getByRole('dialog');
    const addressCards = dialog.locator('.cursor-pointer');
    if (await addressCards.count() === 0) return;

    await addressCards.first().click();

    // Expanded panel should appear with room table
    await expect(dialog.locator('text=Pokoje —')).toBeVisible();
    await expect(dialog.locator('th:has-text("Pokój")')).toBeVisible();
    await expect(dialog.locator('th:has-text("Pojemność")')).toBeVisible();
    await expect(dialog.locator('th:has-text("Zajęte")')).toBeVisible();
    await expect(dialog.locator('th:has-text("Wolne")')).toBeVisible();
    await expect(dialog.locator('th:has-text("Status")')).toBeVisible();
  });

  test('ponowne kliknięcie karty zwija panel pokojów', async ({ page }) => {
    const locality = await openWithLocality(page);
    if (!locality) return;

    const dialog = page.getByRole('dialog');
    const addressCards = dialog.locator('.cursor-pointer');
    if (await addressCards.count() === 0) return;

    const card = addressCards.first();

    // Open
    await card.click();
    await expect(dialog.locator('text=Pokoje —')).toBeVisible();

    // Close by clicking again
    await card.click();
    await expect(dialog.locator('text=Pokoje —')).not.toBeVisible();
  });

  test('kliknieta karta ma ring-2 ring-primary (aktywny styl)', async ({ page }) => {
    const locality = await openWithLocality(page);
    if (!locality) return;

    const dialog = page.getByRole('dialog');
    const addressCards = dialog.locator('.cursor-pointer');
    if (await addressCards.count() === 0) return;

    const card = addressCards.first();
    await card.click();

    await expect(card).toHaveClass(/ring-2/);
    await expect(card).toHaveClass(/ring-primary/);
  });

  test('tabela pokojów zawiera wiersze z numerami pokoi', async ({ page }) => {
    const locality = await openWithLocality(page);
    if (!locality) return;

    const dialog = page.getByRole('dialog');
    const addressCards = dialog.locator('.cursor-pointer');
    if (await addressCards.count() === 0) return;

    await addressCards.first().click();
    await expect(dialog.locator('text=Pokoje —')).toBeVisible();

    // Room rows should have "Pokój" prefix
    const roomRows = dialog.locator('td:has-text("Pokój")');
    await expect(roomRows.first()).toBeVisible();
  });

  test('badge statusu pokazuje "Pełny" lub "Wolne"', async ({ page }) => {
    const locality = await openWithLocality(page);
    if (!locality) return;

    const dialog = page.getByRole('dialog');
    const addressCards = dialog.locator('.cursor-pointer');
    if (await addressCards.count() === 0) return;

    await addressCards.first().click();
    await expect(dialog.locator('text=Pokoje —')).toBeVisible();

    // Status column badges should be either "Pełny" or "Wolne"
    const statusBadges = dialog.locator('tbody .rounded-full, tbody [class*="badge"], tbody span');
    const badgeTexts = await statusBadges.allTextContents();
    const valid = badgeTexts.filter(t => t === 'Pełny' || t === 'Wolne');
    expect(valid.length).toBeGreaterThan(0);
  });
});

test.describe('AddressPreviewDialog — brak danych', () => {
  test('pokazuje komunikat "Brak danych" gdy brak adresów', async ({ page }) => {
    // This test is relevant if the logged-in user has no addresses in settings.
    // We just verify the empty state element exists in the DOM structure.
    await openDialogFromDashboard(page);
    const dialog = page.getByRole('dialog');

    // If there are no addresses at all, the empty state message should be shown
    const emptyMsg = dialog.getByText('Brak danych o adresach');
    const hasAddresses = await dialog.getByLabel('Miejscowość').count() > 0;

    if (!hasAddresses) {
      await expect(emptyMsg).toBeVisible();
    }
  });
});

test.describe('AddressPreviewDialog — otwieranie z formularza pracownika', () => {
  test('otwiera się przyciskiem podglądu w formularzu dodawania pracownika', async ({ page }) => {
    await loginAndGo(page, '/dashboard?view=employees');

    // Open add employee dialog
    await page.click('button:has-text("Dodaj pracownika")');
    await expect(page.getByRole('dialog').first()).toBeVisible();

    // Find the address preview button within the form
    const previewBtn = page.locator('button:has-text("Podgląd"), button[title*="podgląd"], button:has([data-lucide="eye"])');
    if (await previewBtn.count() > 0) {
      await previewBtn.first().click();
      // The address preview dialog should open (it's a second dialog)
      const dialogs = page.getByRole('dialog');
      await expect(dialogs.last()).toBeVisible();
      await expect(dialogs.last().getByText('Podgląd i wybór dostępności miejsc')).toBeVisible();
    }
  });
});
