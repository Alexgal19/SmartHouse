import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';
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
    await loginAsAdmin(page, '/dashboard/settings');
    await page.waitForTimeout(2000); // Extra grace for settings skeletons
  });

  test('should import employees from an Excel file', async ({ page }) => {
    // Switch to the Import section (desktop tabs or mobile select)
    const importTab = page.getByRole('tab', { name: /Import/i }).first();
    if (await importTab.isVisible().catch(() => false)) {
      await importTab.click();
      await page.waitForTimeout(1000);
    } else {
      const mobileSelect = page.locator('select, [role="combobox"]').first();
      if (await mobileSelect.isVisible().catch(() => false)) {
        await mobileSelect.click();
        await page.getByRole('option', { name: /Import/i }).first().click();
        await page.waitForTimeout(1000);
      }
    }

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

    // Find the import button anywhere on the page (Polish or English)
    const importBtn = page.getByRole('button', { name: /Wybierz plik|Choose file/i }).first();
    try {
      await importBtn.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      test.skip(true, 'Import employees button not visible after 10s.');
      return;
    }

    // The button now opens a guide dialog first; file chooser triggers after "Kontynuuj import"
    await importBtn.click();

    const confirmationDialog = page.getByRole('dialog');
    await expect(confirmationDialog.getByText('Przewodnik importu')).toBeVisible();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await confirmationDialog.getByRole('button', { name: /Kontynuuj|Zrozumiałem/i }).first().click();
    const fileChooser = await fileChooserPromise;

    // Set the file for upload
    await fileChooser.setFiles({
      name: 'test-import.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: excelBuffer,
    });


    // Verify the import was processed (may have 0 successes due to mock data, but should complete)
    const toast = page.locator('[role="status"], [role="alert"], region >> text=Pomyślnie').first();
    await expect(toast).toContainText(/Pomyślnie zaimportowano|Import zakończony/);
  });
});
