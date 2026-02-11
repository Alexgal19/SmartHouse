import { test, expect } from '@playwright/test';

test.describe('Settings View', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    // TODO: Replace with actual test credentials
    const username = 'testuser';
    const password = 'testpassword';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.click('button:has-text("Zaloguj się")');
    await page.waitForURL('/dashboard?view=dashboard');
    
    // Navigate to settings view
    await page.goto('/dashboard?view=settings');
  });

  test('should allow managing lists', async ({ page }) => {
    // Open the "List Management" accordion
    await page.click('button:has-text("Zarządzanie listami")');

    // Open the "Nationalities" accordion
    await page.click('button:has-text("Narodowości")');

    // Add a new nationality
    const newNationality = 'Testlandia';
    await page.locator('div.border.rounded-md.px-4:has-text("Narodowości")').locator('button:has-text("Dodaj")').click();

    // The "Add multiple" dialog opens
    const dialog = page.locator('div[role="dialog"]:has-text("Dodaj wiele do: Narodowości")');
    await dialog.locator('textarea').fill(newNationality);
    await dialog.locator('button:has-text("Dodaj z listy")').click();

    // There is no save button for the whole form, the add/remove is instant.
    // So we just need to verify the new item is there.
    const nationalityInput = page.locator(`input[value="${newNationality}"]`);
    await expect(nationalityInput).toBeVisible();

    // Remove the new nationality
    await nationalityInput.locator('..').locator('button[aria-label="Delete"]').click();
    await expect(nationalityInput).not.toBeVisible();
  });

  test('should allow managing coordinators', async ({ page }) => {
    // Open the "Coordinator Management" accordion
    await page.click('button:has-text("Zarządzanie koordynatorami")');

    // Add a new coordinator
    await page.locator('button:has-text("Dodaj koordynatora")').click();

    // The new coordinator accordion item appears
    const newCoordinator = page.locator('div.border.rounded-md.px-4:has-text("Nowy koordynator")');
    await expect(newCoordinator).toBeVisible();

    // Fill in the details
    await newCoordinator.locator('input[name*="name"]').fill('Test Coordinator');
    await newCoordinator.locator('button:has-text("Dodaj zakład")').click();
    await newCoordinator.locator('div.flex.items-center.gap-2').locator('button').first().click();
    await page.locator('div[role="option"]:has-text("IT")').click();

    // Save changes
    await page.click('button:has-text("Zapisz zmiany")');

    // Verify the new coordinator is in the list
    await expect(page.locator('div.border.rounded-md.px-4:has-text("Test Coordinator")')).toBeVisible();
  });

  test('should allow managing addresses', async ({ page }) => {
    // Open the "Address Management" accordion
    await page.click('button:has-text("Zarządzanie adresami")');

    // Add a new address
    await page.locator('button:has-text("Dodaj"):right-of(:text("Filtruj wg koordynatora"))').click();
    
    // The "Add Address" dialog opens
    const dialog = page.locator('div[role="dialog"]:has-text("Dodaj nowy adres")');
    await expect(dialog).toBeVisible();

    // Fill in the form
    await dialog.locator('input[name="name"]').fill('Test Address');
    await dialog.locator('button[role="combobox"]').click();
    await page.locator('div[role="option"]:has-text("Warszawa")').click();
    
    // Add a room
    await dialog.locator('button:has-text("Dodaj pokój")').click();
    await dialog.locator('input[name="rooms.0.name"]').fill('101');
    await dialog.locator('input[name="rooms.0.capacity"]').fill('2');
    
    // Save the address
    await dialog.locator('button:has-text("Zapisz")').click();

    // Verify the new address is in the list
    await expect(page.locator('p.font-semibold:has-text("Test Address")')).toBeVisible();
  });

  test('should allow bulk transferring employees', async ({ page }) => {
    // This test assumes two coordinators "Jan Kowalski" and "Anna Nowak" exist.
    
    // Select "from" coordinator
    await page.locator('div.space-y-2:has-text("Od koordynatora")').locator('button').click();
    await page.locator('div[role="option"]:has-text("Jan Kowalski")').click();

    // Select "to" coordinator
    await page.locator('div.space-y-2:has-text("Do koordynatora")').locator('button').click();
    await page.locator('div[role="option"]:has-text("Anna Nowak")').click();
    
    // Click transfer button
    await page.click('button:has-text("Przenieś")');
    
    // Verify the transfer was successful
    const toast = page.locator('div[role="status"]');
    await expect(toast).toContainText('Pracownicy zostali przeniesieni');
  });
});
