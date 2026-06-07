import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Authentication', () => {
  test('should allow a user to log in', async ({ page }) => {
    await loginAsAdmin(page);

    // Check if the dashboard is loaded (login redirects to /dashboard)
    await expect(page).toHaveURL('/dashboard');
    // Verify sidebar/navigation is present (may take extra time after data loads)
    await expect(page.locator('aside')).toBeVisible({ timeout: 30000 });
  });
});
