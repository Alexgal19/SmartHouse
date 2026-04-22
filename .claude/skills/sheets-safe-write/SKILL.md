---
name: sheets-safe-write
description: Use this skill BEFORE writing, editing, or reviewing ANY code that reads or writes to Google Sheets in the SmartHouse project. Invoke when the task mentions Google Sheets, arkusz, addRow, updateRow, deleteRow, getSheet, getSafeSheet, lub jakąkolwiek modyfikację danych w src/lib/actions.ts lub src/lib/sheets.ts. Also invoke when user asks to "usuń", "skasuj", "wyczyść", "dodaj kolumnę", or "zmodyfikuj" anything related to residents, employees, coordinators, addresses, or any business data.
---

# Sheets Safe Write — Protokół ochrony danych Google Sheets

## Kontekst

Google Sheets to **główna baza produkcyjna** SmartHouse. Dane mieszkańców, pracowników, adresów i powiadomień są **nieodzyskiwalne** jeśli zostaną usunięte.

Reguła #8 w [AGENTS.md](../../../AGENTS.md) oraz CLAUDE.md zakazuje usuwania danych z Google Sheets. Ten skill egzekwuje tę regułę **zanim** kod zostanie napisany.

## Kroki do wykonania

### 1. Przeczytaj warstwę ochronną

Zanim napiszesz kod operujący na arkuszu, **przeczytaj**:
- [src/lib/safe-sheets.ts](../../../src/lib/safe-sheets.ts) — lista dozwolonych operacji
- Odpowiednią sekcję [src/lib/sheets.ts](../../../src/lib/sheets.ts) dla danego arkusza

### 2. Zidentyfikuj typ operacji

| Operacja | Dozwolona metoda | Uwagi |
|---|---|---|
| Odczyt wierszy | `getSafeSheet().getRows()` | Zawsze OK |
| Odczyt nagłówków | `getSafeSheet().getHeaders()` | Zawsze OK |
| Dodanie wiersza | `getSafeSheet().addRow(data)` | Zawsze OK |
| Aktualizacja wiersza | `getSafeSheet().updateRowById(id, updates)` | Wymaga `id` |
| Dodanie kolumny | `getSafeSheet().addColumnsSafely(headers)` | Nigdy nie nadpisuje istniejących |
| **Usunięcie wiersza** | ❌ **ZAKAZANE** | STOP — zapytaj właściciela |
| **Usunięcie kolumny** | ❌ **ZAKAZANE** | STOP — zapytaj właściciela |
| **Masowe czyszczenie** | ❌ **ZAKAZANE** | STOP — zapytaj właściciela |

### 3. Zakazane wzorce — automatyczna blokada

Jeśli masz wygenerować kod zawierający **którykolwiek** z poniższych, **natychmiast zatrzymaj się** i zgłoś blokera:

```typescript
// ❌ WSZYSTKIE poniższe są ZABRONIONE
row.delete()
sheet.clearRows()
sheet.deleteRows(...)
sheet.clear()
await getSheet(name)  // bez getSafeSheet() dla zapisów
// eslint-disable-next-line no-restricted-syntax  // nigdy nie kopiuj tego!
```

### 4. Wzorzec bezpiecznej implementacji

```typescript
// ✅ DOBRZE — soft delete przez kolumnę statusu
const sheet = await getSafeSheet('Pracownicy');
await sheet.updateRowById(employeeId, {
  status: 'zwolniony',
  dataWymeldowania: new Date().toISOString(),
});

// ✅ DOBRZE — dodanie z walidacją
const sheet = await getSafeSheet('NonEmployees');
await sheet.addRow({
  id: crypto.randomUUID(),
  imie: data.imie,
  nazwisko: data.nazwisko,
  // ... wszystkie wymagane pola z types.ts
});
```

### 5. Gdy użytkownik prosi o "usunięcie"

**Zawsze** zaproponuj alternatywę zamiast fizycznego usuwania:

1. **Soft delete** — dodaj kolumnę `status` / `active` / `deletedAt`
2. **Archiwizacja** — dodaj flagę `archived=true`
3. **Zmiana statusu** — np. pracownik → status `zwolniony`

Dopiero jeśli użytkownik **pisemnie potwierdzi** że naprawdę chce usunąć dane, zgłoś blokera do orchestratora — NIE implementuj usuwania samodzielnie.

## Checklist przed oddaniem kodu

- [ ] Każdy zapis używa `getSafeSheet()`, nie `getSheet()`
- [ ] Brak `row.delete()`, `clearRows()`, `deleteRows()`
- [ ] Brak komentarzy `// eslint-disable-next-line no-restricted-syntax`
- [ ] Pola w `addRow()` zgodne z typami z [src/types.ts](../../../src/types.ts)
- [ ] `updateRowById` używa poprawnego `id` z typu

## Output dla Orchestratora

Po zakończeniu zgłoś:
```
SHEETS_SAFE_WRITE_AUDIT:
  operations: [add, update, read]  # zawsze lista dozwolonych
  files_touched: [src/lib/actions.ts, ...]
  forbidden_patterns_found: 0
  owner_approval_needed: false
```

Jeśli `owner_approval_needed: true` — **przerwij pracę** i zgłoś blokera.
