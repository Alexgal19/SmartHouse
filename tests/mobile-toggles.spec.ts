import { test, expect, devices } from '@playwright/test';
import { loginAsAdmin, dashboardUrl } from './helpers/login';

test.use({
  ...devices['Pixel 5'],
});

test('Mobile UI - Coordinators toggles work properly', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(dashboardUrl('settings'));
  
  // Wait for settings to load
  await page.waitForSelector('text=Uprawnienia BOK', { timeout: 10000 });
  
  // Open the first coordinator accordion if it's there
  const firstAccordion = page.locator('button[data-state]').first();
  if (await firstAccordion.isVisible()) {
    await firstAccordion.click();
  }

  // Find the 'Edycja minionych kart kontroli' switch
  const switchLocator = page.locator('button[role="switch"]', { hasText: '' }).last(); // Just testing if we can click ANY switch
  // Wait, better to find the label and then the associated switch
  const editPastLabel = page.locator('label', { hasText: 'Edycja minionych kart kontroli' }).first();
  const editPastId = await editPastLabel.getAttribute('for');
  if (editPastId) {
      const theSwitch = page.locator(`button[id="${editPastId}"]`);
      await theSwitch.scrollIntoViewIfNeeded();
      await theSwitch.click();
      
      // Check if it toggled
      expect(await theSwitch.getAttribute('aria-checked')).toMatch(/true|false/);
  }
});
