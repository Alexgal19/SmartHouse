import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

// Helper function to create a mock Excel file in memory
function createMockExcel(data: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Arkusz1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test.describe('Excel Import', () => {
  // Log in before each test
  test.beforeEach(async ({ page }) => {
    const username = 'admin';
    const password = 'SWhouse$21';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/dashboard?view=dashboard');
    
    // Navigate to settings view
    await page.goto('/dashboard?view=settings');
  });

  test('should import employees from an Excel file', async ({ page }) => {
    // Create a mock Excel file
    const excelData = [
      { 
        'Imię': 'ExcelTest', 
        'Nazwisko': 'User', 
        'Koordynator': 'Jan Kowalski', 
        'Data zameldowania': '01.01.2024', 
        'Zakład': 'IT', 
        'Miejscowość': 'Warszawa', 
        'Adres': 'Testowa 1', 
        'Pokój': '101', 
        'Narodowość': 'Polska' 
      },
    ];
    const excelBuffer = createMockExcel(excelData);

    // Find the "Import Employees" section and trigger the file input
    const importEmployeesCard = page.locator('div').filter({ hasText: /^Import Pracowników z Excel$/ });

    // Playwright needs to receive a file input to upload.
    // We expect the button to trigger a hidden file input.
    const fileChooserPromise = page.waitForEvent('filechooser');
    await importEmployeesCard.getByRole('button', { name: 'Wybierz plik i importuj', exact: true }).click();
    const fileChooser = await fileChooserPromise;

    // Set the file for upload
    await fileChooser.setFiles({
      name: 'test-import.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: excelBuffer,
    });

    // There might be a confirmation dialog after selecting the file
    const confirmationDialog = page.getByRole('dialog');
    await expect(confirmationDialog.getByText('Przewodnik importu')).toBeVisible();
    await confirmationDialog.getByRole('button', { name: 'Kontynuuj import', exact: true }).click();


    // Verify the import was successful
    const toast = page.locator('div[role="status"]');
    await expect(toast).toContainText('Pomyślnie zaimportowano');
  });
});
