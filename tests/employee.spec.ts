import { test, expect } from '@playwright/test';

test.describe('Employee Management', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    // TODO: Replace with actual test credentials
    const username = 'testuser';
    const password = 'testpassword';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.click('button:has-text("Zaloguj się")');
    await page.waitForURL('/dashboard?view=dashboard');
  });

  test('should allow a user to add a new employee', async ({ page }) => {
    // Click the "Add Employee" button to open the dialog
    // I'm assuming the button has the text "Dodaj pracownika"
    await page.click('button:has-text("Dodaj pracownika")');

    // Wait for the dialog to be visible
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    // Fill in the form
    await dialog.locator('input[name="lastName"]').fill('Testowy');
    await dialog.locator('input[name="firstName"]').fill('Jan');

    // --- Select from Combobox ---
    await dialog.locator('label:has-text("Koordynator")').locator('..').locator('button').click();
    await page.locator('div[cmdk-item]:has-text("Jan Kowalski")').click();

    await dialog.locator('label:has-text("Narodowość")').locator('..').locator('button').click();
    await page.locator('div[cmdk-item]:has-text("Polska")').click();
    
    // --- Select from normal select ---
    await dialog.locator('label:has-text("Płeć")').locator('..').locator('button').click();
    await page.locator('div[role="option"]:has-text("Mężczyzna")').click();
    
    await dialog.locator('label:has-text("Miejscowość")').locator('..').locator('button').click();
    await page.locator('div[cmdk-item]:has-text("Warszawa")').click();

    await dialog.locator('label:has-text("Adres")').locator('..').locator('button').click();
    await page.locator('div[role="option"]:has-text("Testowa 1")').click();

    await dialog.locator('label:has-text("Pokój")').locator('..').locator('button').click();
    await page.locator('div[role="option"]:has-text("101")').click();

    await dialog.locator('label:has-text("Zakład")').locator('..').locator('button').click();
    await page.locator('div[cmdk-item]:has-text("IT")').click();


    // --- Date input ---
    await dialog.locator('label:has-text("Data zameldowania")').locator('..').locator('input').fill('2024-01-01');

    // Click the "Save" button
    await dialog.locator('button:has-text("Zapisz")').click();

    // Verify that the employee was added (e.g., by checking for a success toast)
    const toast = page.locator('div[role="status"]');
    await expect(toast).toContainText('pomyślnie'); // Assuming the toast contains the word "successfully" in Polish
  });

  test('should show validation errors for required fields', async ({ page }) => {
    // Click the "Add Employee" button to open the dialog
    await page.click('button:has-text("Dodaj pracownika")');

    // Wait for the dialog to be visible
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click the "Save" button without filling in the form
    await dialog.locator('button:has-text("Zapisz")').click();

    // Check for validation messages
    await expect(dialog.locator('text="Imię jest wymagane."')).toBeVisible();
    await expect(dialog.locator('text="Nazwisko jest wymagane."')).toBeVisible();
    await expect(dialog.locator('text="Koordynator jest wymagany."')).toBeVisible();
    await expect(dialog.locator('text="Miejscowość jest wymagana."')).toBeVisible();
    await expect(dialog.locator('text="Adres jest wymagany."')).toBeVisible();
    await expect(dialog.locator('text="Pokój jest wymagany."')).toBeVisible();
    await expect(dialog.locator('text="Zakład jest wymagany."')).toBeVisible();
    await expect(dialog.locator('text="Narodowość jest wymagana."')).toBeVisible();
    await expect(dialog.locator('text="Płeć jest wymagana."')).toBeVisible();
  });

  test('should allow a user to permanently delete a dismissed employee', async ({ page }) => {
    // This test assumes an employee named "ToDelete" exists and is on the dismissed tab.
    // In a real-world scenario, you would create this employee as part of the test setup.

    // Go to the dismissed tab
    await page.click('button:has-text("Zwolnieni")');
    
    // Find the employee to delete
    const employeeRow = page.locator('tr:has-text("ToDelete")');
    await expect(employeeRow).toBeVisible();

    // Click the dropdown menu
    await employeeRow.locator('button[aria-haspopup="menu"]').click();

    // Click the "Delete forever" button
    await page.click('div[role="menuitem"]:has-text("Usuń na zawsze")');

    // Confirm the deletion in the dialog
    const dialog = page.locator('div[role="alertdialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('button:has-text("Potwierdź i usuń")').click();

    // Verify the employee is no longer in the table
    await expect(employeeRow).not.toBeVisible();
    
    // Optional: check for a success toast
    const toast = page.locator('div[role="status"]');
    await expect(toast).toContainText('usunięto'); // Assuming the toast contains the word "deleted" in Polish
  });

  test('should fill in form fields with data from mocked OCR', async ({ page }) => {
    // Mock the OCR API response
    await page.route('**/api/extractPassportData', async (route) => {
      const json = {
        firstName: 'MockedFirstName',
        lastName: 'MockedLastName',
      };
      await route.fulfill({ json });
    });
    
    // Open the "Add Employee" dialog
    await page.click('button:has-text("Dodaj pracownika")');

    const dialog = page.locator('div[role="dialog"]:has-text("Dodaj nowego pracownika")');
    await expect(dialog).toBeVisible();

    // Click the "Take a picture of the passport" button
    await dialog.locator('button:has-text("Zrób zdjęcie paszportu")').click();

    // Wait for the camera dialog to open
    const cameraDialog = page.locator('div[role="dialog"]:has-text("Zrób zdjęcie paszportu")');
    await expect(cameraDialog).toBeVisible();
    
    // There is no file to upload, so we assume the capture button triggers the mocked API call.
    // We also need to handle the webcam, which is not possible in headless.
    // So we will just click the capture button.
    await cameraDialog.locator('button:has-text("Zrób zdjęcie")').click();

    // Check if the form fields are filled with mocked data
    await expect(dialog.locator('input[name="firstName"]')).toHaveValue('MockedFirstName');
    await expect(dialog.locator('input[name="lastName"]')).toHaveValue('MockedLastName');
  });
});
