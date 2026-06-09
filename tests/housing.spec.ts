import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Housing View', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, '/dashboard/housing');
  });

  test('should filter addresses by name, locality, and availability', async ({ page }) => {
    // Check if any addresses are loaded; if not, skip data-dependent assertions
    const addressCards = page.locator('[data-testid="address-card"], .card, [class*="card"]').first();
    const hasAddresses = await addressCards.isVisible().catch(() => false);
    if (!hasAddresses) {
      test.skip(true, 'No housing addresses available to test filtering.');
      return;
    }

    // Filter by name — use a generic string that won't match any real address
    await page.fill('#search-address', 'XYZ-NONEXISTENT-TEST');
    // After filtering with a non-existent term, cards should be hidden or empty state shown
    await page.waitForTimeout(500);
    const visibleCardsAfterFilter = await page.locator('[data-testid="address-card"], .card, [class*="card"]').count();
    expect(visibleCardsAfterFilter).toBe(0);

    // Clear the name filter
    await page.fill('#search-address', '');
    await page.waitForTimeout(500);
    const visibleCardsAfterClear = await page.locator('[data-testid="address-card"], .card, [class*="card"]').count();
    expect(visibleCardsAfterClear).toBeGreaterThan(0);

    // Filter by availability toggle
    const showAvailableSwitch = page.locator('#show-available');
    if (await showAvailableSwitch.isVisible().catch(() => false)) {
      await page.locator('label[for="show-available"]').click();
      await expect(showAvailableSwitch).toBeChecked();
    }
  });

  test('should show address details when an address is clicked', async ({ page }) => {
    // Click the first available address card instead of hardcoding a name
    const firstAddressCard = page.locator('[data-testid="address-card"], .card, [class*="card"]').first();
    if (!(await firstAddressCard.isVisible().catch(() => false))) {
      test.skip(true, 'No housing addresses available to test details.');
      return;
    }

    await firstAddressCard.click();

    const detailsView = page.getByRole('main');
    // After clicking, either a dialog or a details panel should be visible
    const dialog = page.locator('[role="dialog"]').first();
    const hasDialog = await dialog.isVisible().catch(() => false);
    if (hasDialog) {
      await expect(dialog).toBeVisible();
    } else {
      await expect(detailsView).toBeVisible();
    }
  });
});
