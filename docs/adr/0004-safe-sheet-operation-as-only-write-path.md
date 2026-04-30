# ADR-004 — SafeSheetOperation jako jedyna ścieżka zapisu do Google Sheets

**Status:** accepted
**Data:** 2026-04-26
**Decydent:** Project owner

## Kontekst

Google Sheets jest primary store ([ADR-001](./0001-google-sheets-as-primary-store.md)). Biblioteka `google-spreadsheet` udostępnia bezpośrednie metody jak `sheet.deleteRows()`, `row.delete()`, `sheet.clearRows()`, które mogą skasować dane bez możliwości łatwego odzyskania (Google Drive history pomaga, ale przywrócenie konkretnego stanu wymaga pracy ręcznej).

W przeszłości doszło do incydentu utraty danych z powodu nieostrożnej operacji.

## Decyzja

Wszystkie operacje **modyfikujące** Google Sheets idą przez warstwę `SafeSheetOperation` w [`src/lib/safe-sheets.ts`](../../src/lib/safe-sheets.ts).

Dozwolone operacje:

- `addRow(data)` — dodanie wiersza
- `updateRowById(rowId, updates)` — update istniejącego wiersza po ID (z walidacją)
- `addColumnsSafely(columns)` — dodanie kolumn
- `getRows(options)` — odczyt
- `getHeaders()` — odczyt nagłówków

**Zakazane** (ESLint zablokuje build — zobacz [ADR-005](./0005-eslint-no-restricted-syntax-blocks-sheets-delete.md)):

- `row.delete()`
- `sheet.clearRows()`
- `sheet.deleteRows()`

## Konsekwencje

**Pozytywne:**

- Niemożliwe wprowadzenie kasowania danych przez nieuwagę
- Wszystkie zapisy mają jednolity entry point — łatwy audyt, log, retry, validation
- Code review skupia się na logice biznesowej, nie na sprawdzaniu czy ktoś nie usunął danych

**Negatywne:**

- Niemożliwe legalne kasowanie danych przez kod — wymaga ręcznej akcji właściciela w arkuszu
- Workaround: kolumna `deletedAt` (soft delete) + filtr w odczycie

## Wyjątki

Jeśli funkcjonalność wymaga twardego usunięcia danych:

1. **STOP** — nie implementuj
2. Zapytaj właściciela projektu o pisemną zgodę
3. Po zgodzie: dodaj `// eslint-disable-next-line no-restricted-syntax` z komentarzem wyjaśniającym + ID zgody
4. Soft delete (`deletedAt` column) jest **zawsze** preferowany

## Alternatywy rozważane

- **Brak warstwy ochronnej** (status quo przed incydentem) — odrzucone: udowodniona ścieżka utraty danych
- **Code review tylko** — odrzucone: ludzkie błędy, presja czasu, copy-paste z innych projektów
- **Backup automation** — odrzucone jako jedyne zabezpieczenie: spowalnia recovery, nie zapobiega błędowi
