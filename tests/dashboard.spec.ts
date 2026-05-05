import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    const username = 'admin';
    const password = 'SWhouse$21';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/dashboard?view=dashboard');
  });

  test('should display the dashboard with KPI cards and quick actions', async ({ page }) => {
    // Check for KPI cards (use heading role to avoid strict-mode violations in WebKit)
    await expect(page.getByRole('heading', { name: 'Wszyscy pracownicy', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mieszkańcy (NZ)', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Używane mieszkania', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wykwaterowania (30 dni)', exact: true })).toBeVisible();

    // Check for Quick Actions
    await expect(page.getByRole('heading', { name: 'Szybkie działania', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dodaj pracownika', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dodaj mieszkańca (NZ)', exact: true })).toBeVisible();
  });

  test('should navigate to correct views when quick action buttons are clicked', async ({ page }) => {
    // Test "Add Non-Employee" button
    await page.getByRole('button', { name: 'Dodaj mieszkańca (NZ)', exact: true }).click();
    const nonEmployeeDialog = page.getByTestId('add-non-employee-dialog');
    await expect(nonEmployeeDialog.getByText('Dane osoby')).toBeVisible();
    // Close the dialog
    await nonEmployeeDialog.getByRole('button', { name: 'Close' }).click();

    // Test "Search Resident" button
    await page.getByRole('button', { name: 'Wyszukaj mieszkańca', exact: true }).click();
    await expect(page).toHaveURL('/dashboard?view=employees');

    // Go back to dashboard for next test
    await page.goto('/dashboard?view=dashboard');

    // Test "Browse Apartments" button
    await page.click('button:has-text("Przeglądaj mieszkania")');
    await expect(page).toHaveURL('/dashboard?view=housing');
  });
});
