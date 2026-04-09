'use server';

import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

/**
 * Bezpośrednia operacja na arkuszu z wbudowaną ochroną przed utratą danych
 * Wszystkie operacje modyfikujące muszą przejść przez tę warstwę
 */

export class SafeSheetOperation {
  constructor(private sheet: GoogleSpreadsheetWorksheet) {}

  /**
   * Bezpieczne dodanie nowego wiersza - ZAWSZE DOZWOLONE
   * Używa właściwego typu danych zgodnego z google-spreadsheet
   */
  async addRow(data: Record<string, string | number | boolean>) {
    return await this.sheet.addRow(data, { raw: false, insert: true });
  }

  /**
   * Bezpieczne zaktualizowanie konkretnego wiersza - wymaga znajomości ID
   * Niedozwolone: masowe aktualizacje bez filtru
   */
  async updateRowById(rowId: string, updates: Record<string, string | number | boolean>) {
    const rows = await this.sheet.getRows();
    const row = rows.find((r) => r.get('id') === rowId);

    if (!row) throw new Error(`Row with id ${rowId} not found`);

    // Tylko aktualizacja istniejącego wiersza - bezpieczna operacja
    for (const [key, value] of Object.entries(updates)) {
      row.set(key, value);
    }

    return await row.save();
  }

  /**
   * Bezpieczne pobranie danych - ZAWSZE DOZWOLONE
   */
  async getRows(options?: { limit?: number }) {
    const rows = await this.sheet.getRows(options);
    return rows.map((r) => r.toObject());
  }

  /**
   * Bezpieczne pobranie nagłówków - ZAWSZE DOZWOLONE
   */
  async getHeaders() {
    await this.sheet.loadHeaderRow();
    return this.sheet.headerValues;
  }

  /**
   * Bezpieczne dodanie nowych kolumn - DOZWOLONE TYLKO PRZEZ TĘ METODĘ
   * Zapobiega przypadkowemu usunięciu istniejących kolumn
   */
  async addColumnsSafely(newHeaders: string[]) {
    const currentHeaders = await this.getHeaders();
    const missingHeaders = newHeaders.filter((h) => !currentHeaders.includes(h));

    if (missingHeaders.length === 0) return;

    // Tylko rozszerzamy nagłówki, nigdy nie usuwamy
    await this.sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
  }

  // CELOWO BRAK metod: clearRows(), deleteRows(), masowych operacji bez filtrów
}

/**
 * Fabryka tworząca bezpieczne operacje na arkuszu
 */
export async function getSafeSheet(title: string, requiredHeaders: string[] = []): Promise<SafeSheetOperation> {
  // Dynamic import to avoid circular dependency
  const { getSheet } = await import('./sheets');
  const sheet = await getSheet(title, requiredHeaders);
  return new SafeSheetOperation(sheet);
}
