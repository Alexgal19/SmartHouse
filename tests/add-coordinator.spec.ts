import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

// Password protecting the coordinator management section in settings
const COORD_PASSWORD = '2121';

test('Can add a coordinator', async ({ page }) => {
  // Login and go directly to settings page; wait for full data load
  await loginAsAdmin(page, '/dashboard/settings');

  // Open the "Coordinator Management" accordion
  const coordAccordion = page.getByRole('button', { name: 'Zarządzanie koordynatorami', exact: true });
  await coordAccordion.waitFor({ state: 'visible', timeout: 30_000 });
  await coordAccordion.click();
  await page.waitForTimeout(600);

  // The section is password-protected — unlock it
  const pwdInput = page.locator('input[type="password"]').first();
  await pwdInput.waitFor({ state: 'visible', timeout: 8_000 });
  await pwdInput.fill(COORD_PASSWORD);

  const unlockButton = page.getByRole('button', { name: 'Odblokuj', exact: true });
  await unlockButton.click();
  await page.waitForTimeout(500);

  // Now the coordinator form should be accessible via "Dodaj koordynatora" button
  const addButton = page.locator('button', { hasText: 'Dodaj koordynatora' });
  await addButton.waitFor({ state: 'visible', timeout: 10_000 });
  await addButton.click();

  // Wait for modal
  const modal = page.getByRole('dialog');
  await modal.waitFor({ state: 'visible', timeout: 8_000 });

  // Fill in the coordinator name
  const nameInput = modal.locator('input[name="name"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5_000 });
  await nameInput.fill('Testowy Koordynator');

  // Submit the form
  const saveBtn = modal.locator('button[type="submit"]').first();
  await saveBtn.click();

  // Wait a bit for the result
  await page.waitForTimeout(1500);

  // Check if modal closed (success) or has validation errors
  const isModalVisible = await modal.isVisible();

  if (isModalVisible) {
    // Modal still open — check for errors
    const errors = await modal.locator('.text-destructive').allTextContents();
    console.log('Validation errors after submit:', errors);
    expect(errors.length, `Expected no validation errors but got: ${errors.join(', ')}`).toBe(0);
  } else {
    // Modal closed — success
    console.log('Modal closed successfully — coordinator added.');
  }
});
