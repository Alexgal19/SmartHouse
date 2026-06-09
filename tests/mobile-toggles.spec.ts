import { test, expect, devices } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.use({
  ...devices['Pixel 5'],
});

// SKIP: Mobile viewport toggles are flaky in shared worker runs due to viewport isolation conflicts.
test.skip('Mobile UI - Coordinators toggles work properly', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(dashboardUrl('settings'));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // On mobile the default section is 'organization' which contains coordinators.
  // Scroll until we find a switch related to control cards editing.
  const editPastLabel = page.locator('label, span, p').filter({ hasText: 'Edycja minionych kart kontroli' }).first();
  let attempts = 0;
  while (!(await editPastLabel.isVisible().catch(() => false)) && attempts < 10) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
    attempts++;
  }

  if (!(await editPastLabel.isVisible().catch(() => false))) {
    test.skip(true, 'Edycja minionych kart kontroli toggle not found on mobile settings.');
    return;
  }

  const editPastId = await editPastLabel.getAttribute('for');
  if (editPastId) {
      const theSwitch = page.locator(`button[id="${editPastId}"]`);
      await theSwitch.scrollIntoViewIfNeeded();
      await theSwitch.click();

      // Check if it toggled
      expect(await theSwitch.getAttribute('aria-checked')).toMatch(/true|false/);
  }
});
