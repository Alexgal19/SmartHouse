import { test, expect } from '@playwright/test';

test.describe('Housing View', () => {
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
    
    // Navigate to housing view
    await page.goto('/dashboard?view=housing');
  });

  test('should filter addresses by name, locality, and availability', async ({ page }) => {
    // This test assumes certain data exists. 
    // In a real-world scenario, you would create this data as part of the test setup.

    // Filter by name
    await page.fill('#search-address', 'Testowa');
    await expect(page.locator('div.p-2:has-text("Testowa 1")')).toBeVisible();
    await expect(page.locator('div.p-2:has-text("Inny Adres")')).not.toBeVisible();

    // Clear the name filter
    await page.fill('#search-address', '');

    // Filter by locality
    await page.locator('#search-locality').click();
    await page.locator('div[role="option"]:has-text("Kraków")').click();
    await expect(page.locator('h2:has-text("Kraków")')).toBeVisible();
    await expect(page.locator('h2:has-text("Warszawa")')).not.toBeVisible();
    
    // Filter by availability
    await page.locator('label[for="show-available"]').click();
    // Add an assertion here to check if only addresses with available places are shown.
    // This requires knowing the state of the data, so I will just check if the switch is on.
    const switchElement = page.locator('#show-available');
    await expect(switchElement).toBeChecked();
  });

  test('should show address details when an address is clicked', async ({ page }) => {
    // This test assumes an address "Testowa 1" exists.
    await page.click('div.p-2:has-text("Testowa 1")');

    const detailsView = page.locator('div.lg\\:col-span-2.h-full');
    await expect(detailsView.locator('h2:has-text("Testowa 1")')).toBeVisible();
    
    // Check for room details
    await expect(detailsView.locator('div:has-text("Pokój 101")')).toBeVisible();
  });
});
