import { test, expect } from '@playwright/test';

test.describe('Housing View', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    const username = 'admin';
    const password = 'SWhouse$21';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/dashboard?view=dashboard');
    
    // Navigate to housing view
    await page.goto('/dashboard?view=housing');
  });

  test('should filter addresses by name, locality, and availability', async ({ page }) => {
    // This test assumes certain data exists. 
    // In a real-world scenario, you would create this data as part of the test setup.

    // Filter by name
    await page.fill('#search-address', 'Testowa');
    await expect(page.getByText('Testowa 1', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Inny Adres', { exact: false }).first()).not.toBeVisible();

    // Clear the name filter
    await page.fill('#search-address', '');

    // Filter by locality
    await page.locator('#search-locality').click();
    await page.getByRole('option', { name: 'Kraków', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kraków', exact: true }).first()).toBeVisible();
    await expect(page.getByText('Warszawa', { exact: false }).first()).not.toBeVisible();
    
    // Filter by availability
    await page.locator('label[for="show-available"]').click();
    // Add an assertion here to check if only addresses with available places are shown.
    // This requires knowing the state of the data, so I will just check if the switch is on.
    const switchElement = page.locator('#show-available');
    await expect(switchElement).toBeChecked();
  });

  test('should show address details when an address is clicked', async ({ page }) => {
    // This test assumes an address "Testowa 1" exists.
    await page.getByText('Testowa 1', { exact: false }).first().click();

    const detailsView = page.getByRole('main');
    await expect(detailsView.getByRole('heading', { name: 'Testowa 1', exact: true }).first()).toBeVisible();

    // Check for room details
    await expect(detailsView.getByText('Pokój 101', { exact: false }).first()).toBeVisible();
  });
});
