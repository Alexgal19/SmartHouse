import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow a user to log in', async ({ page }) => {
    // TODO: Replace with actual test credentials
    const username = 'admin';
    const password = 'password';

    await page.goto('/login');

    // Fill in the login form
    await page.fill('#name', username);
    await page.fill('#password', password);

    // Click the login button
    await page.click('button:has-text("Zaloguj się")');

    // Wait for navigation to the dashboard
    await page.waitForURL('/dashboard?view=dashboard');

    // Check if the dashboard is loaded
    await expect(page).toHaveURL('/dashboard?view=dashboard');
    // You can add more assertions here to check for specific elements on the dashboard
  });
});
