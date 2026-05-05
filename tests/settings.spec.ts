import { test, expect } from '@playwright/test';

test.describe('Settings View', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    const username = 'admin';
    const password = 'SWhouse$21';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/dashboard?view=dashboard');
    
    // Navigate to settings view
    await page.goto('/dashboard?view=settings');
  });

  test('should allow managing lists', async ({ page }) => {
    // Open the "List Management" accordion
    await page.getByRole('button', { name: 'Zarządzanie listami', exact: true }).click();
    await page.waitForTimeout(500);

    // Open the "Nationalities" accordion
    await page.getByRole('button', { name: 'Narodowości', exact: true }).click();
    await page.waitForTimeout(500);

    // Add a new nationality
    const newNationality = 'Testlandia';
    // Use first() to avoid strict mode in WebKit
    await page.getByRole('button', { name: 'Dodaj', exact: true }).first().click();

    // The "Add multiple" dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Dodaj wiele do: Narodowości')).toBeVisible();
    await dialog.locator('textarea').fill(newNationality);
    await dialog.getByRole('button', { name: 'Dodaj z listy', exact: true }).click();

    // There is no save button for the whole form, the add/remove is instant.
    // So we just need to verify the new item is there.
    const nationalityInput = page.locator(`input[value="${newNationality}"]`);
    await expect(nationalityInput).toBeVisible();

    // Remove the new nationality
    await nationalityInput.locator('xpath=..').locator('button[aria-label="Delete"]').click();
    await expect(nationalityInput).not.toBeVisible();
  });

  test('should allow managing coordinators', async ({ page }) => {
    // Open the "Coordinator Management" accordion
    await page.getByRole('button', { name: 'Zarządzanie koordynatorami', exact: true }).click();
    await page.waitForTimeout(500);

    // Add a new coordinator
    await page.getByRole('button', { name: 'Dodaj koordynatora', exact: true }).click();
    await page.waitForTimeout(500);

    // The new coordinator accordion item appears
    const newCoordinator = page.locator('div').filter({ hasText: /^Test Coordinator$/ }).first();
    await expect(newCoordinator).toBeVisible();

    // Fill in the details
    await page.locator('input[name*="name"]').first().fill('Test Coordinator');
    await page.getByRole('button', { name: 'Dodaj zakład', exact: true }).first().click();
    await page.locator('div.flex.items-center.gap-2').getByRole('button').first().click();
    await page.getByRole('option', { name: 'IT', exact: true }).click();

    // Save changes
    await page.getByRole('button', { name: 'Zapisz zmiany', exact: true }).first().click();

    // Verify the new coordinator is in the list
    await expect(page.locator('div').filter({ hasText: /^Test Coordinator$/ }).first()).toBeVisible();
  });

  test('should allow managing addresses', async ({ page }) => {
    // Open the "Address Management" accordion
    await page.getByRole('button', { name: 'Zarządzanie adresami', exact: true }).click();
    await page.waitForTimeout(500);

    // Add a new address
    await page.getByRole('button', { name: 'Dodaj', exact: true }).first().click();

    // The "Add Address" dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Dodaj nowy adres')).toBeVisible();

    // Fill in the form
    await dialog.locator('input[name="name"]').fill('Test Address');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Warszawa', exact: true }).click();

    // Add a room
    await dialog.getByRole('button', { name: 'Dodaj pokój', exact: true }).click();
    await dialog.locator('input[name="rooms.0.name"]').fill('101');
    await dialog.locator('input[name="rooms.0.capacity"]').fill('2');

    // Save the address
    await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click();

    // Verify the new address is in the list
    await expect(page.getByText('Test Address', { exact: true }).first()).toBeVisible();
  });

  test('should allow bulk transferring employees', async ({ page }) => {
    // This test assumes two coordinators "Jan Kowalski" and "Anna Nowak" exist.
    
    // Select "from" coordinator
    const fromSection = page.locator('div').filter({ hasText: /^Od koordynatora$/ }).first();
    await fromSection.getByRole('button').first().click();
    await page.getByRole('option', { name: 'Jan Kowalski', exact: true }).click();

    // Select "to" coordinator
    const toSection = page.locator('div').filter({ hasText: /^Do koordynatora$/ }).first();
    await toSection.getByRole('button').first().click();
    await page.getByRole('option', { name: 'Anna Nowak', exact: true }).click();

    // Click transfer button
    await page.getByRole('button', { name: 'Przenieś', exact: true }).first().click();

    // Verify the transfer was successful
    const toast = page.locator('div[role="status"]');
    await expect(toast).toContainText('Pracownicy zostali przeniesieni');
  });
});
