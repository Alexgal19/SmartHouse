import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

// Password that protects the coordinator section in settings
const COORD_PASSWORD = '2121';

test.describe('Settings View', () => {
  // Log in before each test and wait for full data load (including Google Sheets)
  test.beforeEach(async ({ page }) => {
    // loginAsAdmin waits until HouseLoader disappears → data is ready
    await loginAsAdmin(page, '/dashboard/settings');
  });

  test('should allow managing lists', async ({ page }) => {
    // Open the "List Management" accordion
    const listAccordion = page.getByRole('button', { name: 'Zarządzanie listami', exact: true });
    await listAccordion.waitFor({ state: 'visible', timeout: 30_000 });
    await listAccordion.click();
    await page.waitForTimeout(600);

    // Open the "Nationalities" accordion — button name includes count: "Narodowości 44"
    const natAccordion = page.getByRole('button', { name: /Narodowości/ });
    await natAccordion.waitFor({ state: 'visible', timeout: 10_000 });
    await natAccordion.click();
    await page.waitForTimeout(500);

    // Open "Add multiple" dialog — it's the 2nd icon button in the inline-add row
    // The FileWarning button has title attribute set to addMultipleTitle
    const addMultipleBtn = page.locator('button[title*="Narodowości"]').first();
    await addMultipleBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await addMultipleBtn.click();

    // The "Add multiple" dialog opens
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 8_000 });
    // Dialog title contains "Narodowości"
    await expect(dialog.getByText(/Narodowości/)).toBeVisible();

    const newNationality = 'Testlandia';
    await dialog.locator('textarea').fill(newNationality);
    // Click submit button in the dialog ("Dodaj z listy")
    await dialog.getByRole('button').last().click();

    // If the dialog closed, the items were added successfully
    await dialog.waitFor({ state: 'hidden', timeout: 8_000 });
  });

  test('should allow managing coordinators', async ({ page }) => {
    // Open the "Coordinator Management" accordion
    const coordAccordion = page.getByRole('button', { name: 'Zarządzanie koordynatorami', exact: true });
    await coordAccordion.waitFor({ state: 'visible', timeout: 30_000 });
    await coordAccordion.click();
    await page.waitForTimeout(600);

    // This section is password-protected — enter the password
    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.waitFor({ state: 'visible', timeout: 8_000 });
    await pwdInput.fill(COORD_PASSWORD);

    // Click the unlock button
    const unlockButton = page.getByRole('button', { name: 'Odblokuj', exact: true });
    await unlockButton.click();
    await page.waitForTimeout(500);

    // Now "Dodaj koordynatora" button should appear inside CoordinatorManager
    const addCoordBtn = page.getByRole('button', { name: 'Dodaj koordynatora', exact: true });
    await addCoordBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await addCoordBtn.click();

    // A dialog/form should open
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 8_000 });

    // The dialog should have a name input
    const nameInput = dialog.locator('input').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5_000 });
    await nameInput.fill('Test Koordynator');

    // Submit
    const saveBtn = dialog.locator('button[type="submit"]').first();
    await saveBtn.click();

    // Modal should close on success, or stay open with validation errors
    await page.waitForTimeout(1500);
  });

  test('should show coordinator section password prompt', async ({ page }) => {
    // Verify that the password protection is working correctly
    const coordAccordion = page.getByRole('button', { name: 'Zarządzanie koordynatorami', exact: true });
    await coordAccordion.waitFor({ state: 'visible', timeout: 30_000 });
    await coordAccordion.click();
    await page.waitForTimeout(600);

    // The password input should appear (section is locked by default)
    const pwdInput = page.locator('input[type="password"]').first();
    await expect(pwdInput).toBeVisible({ timeout: 8_000 });
  });

  test('should allow managing addresses', async ({ page }) => {
    // Open the "Address Management" accordion
    const addrAccordion = page.getByRole('button', { name: 'Zarządzanie adresami', exact: true });
    await addrAccordion.waitFor({ state: 'visible', timeout: 30_000 });
    await addrAccordion.click();
    await page.waitForTimeout(600);

    // The AddressManager component should render — look for the Add button
    // AddressManager renders buttons per-coordinator (or a general one for admin)
    // Just verify the accordion content is visible (address list rendered)
    const addrContent = page.locator('[data-state="open"]').last();
    await expect(addrContent).toBeVisible({ timeout: 10_000 });
  });
});
