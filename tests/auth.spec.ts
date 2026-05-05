import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow a user to log in', async ({ page }) => {
    const username = 'admin';
    const password = 'SWhouse$21';

    await page.goto('/login');

    // Fill in the login form
    await page.fill('#name', username);
    await page.fill('#password', password);

    // Click the login button
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to the dashboard
    await page.waitForURL('/dashboard?view=dashboard');

    // Check if the dashboard is loaded
    await expect(page).toHaveURL('/dashboard?view=dashboard');
    // You can add more assertions here to check for specific elements on the dashboard
  });
});
