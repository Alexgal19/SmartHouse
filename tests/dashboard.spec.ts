import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    // TODO: Replace with actual test credentials
    const username = 'admin';
    const password = 'password';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.click('button:has-text("Zaloguj się")');
    await page.waitForURL('/dashboard?view=dashboard');
  });

  test('should display the dashboard with KPI cards and quick actions', async ({ page }) => {
    // Check for KPI cards
    await expect(page.locator('div:has-text("Wszyscy pracownicy")')).toBeVisible();
    await expect(page.locator('div:has-text("Mieszkańcy (NZ)")')).toBeVisible();
    await expect(page.locator('div:has-text("Używane mieszkania")')).toBeVisible();
    await expect(page.locator('div:has-text("Wykwaterowania (30 dni)")')).toBeVisible();

    // Check for Quick Actions
    await expect(page.locator('h2:has-text("Szybkie działania")')).toBeVisible();
    await expect(page.locator('button:has-text("Dodaj pracownika")')).toBeVisible();
    await expect(page.locator('button:has-text("Dodaj mieszkańca (NZ)")')).toBeVisible();
  });

  test('should navigate to correct views when quick action buttons are clicked', async ({ page }) => {
    // Test "Add Non-Employee" button
    await page.click('button:has-text("Dodaj mieszkańca (NZ)")');
    const nonEmployeeDialog = page.locator('div[role="dialog"]:has-text("Dodaj nowego mieszkańca (NZ)")');
    await expect(nonEmployeeDialog).toBeVisible();
    // Close the dialog
    await nonEmployeeDialog.locator('button[aria-label="Close"]').click();

    // Test "Search Resident" button
    await page.click('button:has-text("Wyszukaj mieszkańca")');
    await expect(page).toHaveURL('/dashboard?view=employees');

    // Go back to dashboard for next test
    await page.goto('/dashboard?view=dashboard');

    // Test "Browse Apartments" button
    await page.click('button:has-text("Przeglądaj mieszkania")');
    await expect(page).toHaveURL('/dashboard?view=housing');
  });
});
