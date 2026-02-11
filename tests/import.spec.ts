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
    // TODO: Replace with actual test credentials
    const username = 'testuser';
    const password = 'testpassword';

    await page.goto('/login');
    await page.fill('#name', username);
    await page.fill('#password', password);
    await page.click('button:has-text("Zaloguj się")');
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
    const importEmployeesCard = page.locator('div.border.p-4.rounded-lg:has-text("Import Pracowników z Excel")');
    
    // Playwright needs to receive a file input to upload.
    // We expect the button to trigger a hidden file input.
    const fileChooserPromise = page.waitForEvent('filechooser');
    await importEmployeesCard.locator('button:has-text("Wybierz plik i importuj")').click();
    const fileChooser = await fileChooserPromise;

    // Set the file for upload
    await fileChooser.setFiles({
      name: 'test-import.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: excelBuffer,
    });
    
    // There might be a confirmation dialog after selecting the file
    const confirmationDialog = page.locator('div[role="dialog"]:has-text("Przewodnik importu")');
    await expect(confirmationDialog).toBeVisible();
    await confirmationDialog.locator('button:has-text("Kontynuuj import")').click();


    // Verify the import was successful
    const toast = page.locator('div[role="status"]');
    await expect(toast).toContainText('Pomyślnie zaimportowano');
  });
});
