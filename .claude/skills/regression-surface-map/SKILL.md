---
name: regression-surface-map
description: Use this skill AFTER code changes but BEFORE running the full test suite in SmartHouse. Invoke when user says "testy", "sprawdź testy", "odpal playwright", "regresja", "czy coś się zepsuło", "QA", "uruchom testy", "przed PR", "przed merge". This skill analyzes git diff to identify which Playwright E2E tests are actually affected by the change, saving time vs running all tests blindly.
---

# Regression Surface Map — Mapa powierzchni regresji

## Kontekst

Testy E2E w Playwright są wolne. Uruchamianie całego zestawu po każdej zmianie to marnotrawstwo — ale pomijanie testów = produkcyjne regresje. Ten skill mapuje `git diff` na konkretne pliki testów w `tests/**`, wskazując **minimalny zestaw** wymagany do walidacji zmiany + rekomenduje full run dla ryzykownych obszarów.

## Protokół mapowania

### Krok 1 — Zbierz diff

```bash
# Zmiany niestage'owane + stage'owane
git diff HEAD --name-only

# Dla diffu względem main
git diff main...HEAD --name-only
```

### Krok 2 — Zmapuj zmienione pliki na domeny

| Zmodyfikowany plik / katalog | Dotknięte testy Playwright |
|---|---|
| `src/components/forms/EmployeeForm*` | `tests/employee.spec.ts` |
| `src/components/forms/NonEmployeeForm*` | `tests/employee.spec.ts` |
| `src/app/api/employees/**` | `tests/employee.spec.ts` + `tests/dashboard.spec.ts` |
| `src/components/HousingView*`, `src/components/RoomAssignments*` | `tests/housing.spec.ts` + `tests/address-preview-dialog.spec.ts` |
| `src/app/api/housing/**`, `src/lib/housing*` | `tests/housing.spec.ts` |
| `src/app/login/**`, `src/lib/auth*`, `src/middleware.ts` | `tests/auth.spec.ts` |
| `src/app/dashboard/**` | `tests/dashboard.spec.ts` |
| `src/components/SettingsPanel*`, `src/app/api/settings/**` | `tests/settings.spec.ts` |
| `src/components/ImportDialog*`, `src/lib/import*` | `tests/import.spec.ts` |
| `src/lib/sheets.ts`, `src/lib/safe-sheets.ts` | **WSZYSTKIE testy** (core dependency) |
| `src/lib/actions.ts` | Zidentyfikuj konkretne funkcje; zmapuj przez grep |
| `src/types.ts` | Uruchom `tsc --noEmit` + cały suite jeśli breaking type |
| `src/lib/alert-utils.ts`, `src/app/api/alerts/**` | Brak E2E — wymaga unit testu (Jest/Vitest) |
| `src/app/api/push/**`, `lib/push/**` | Brak E2E — ręczna walidacja na urządzeniu |

### Krok 3 — Reguły specjalne

**High-risk changes — odpal full suite:**

- Zmiany w `src/middleware.ts` → cały `tests/auth.spec.ts` + losowy sampling
- Zmiany w `next.config.*` → full build + smoke testy
- Zmiany w `firebase.json`, `apphosting.yaml` → nie uruchamiaj Playwright, DevOps smoke
- Zmiany w `src/lib/safe-sheets.ts` → ręczny audyt + wszystkie testy modyfikujące dane
- Zmiany w `package.json` → full clean install + full suite

**Low-risk changes — skip E2E, wystarczy lint + build:**

- Tylko komentarze / formatowanie
- Tylko dodanie nowych kolorów w `tailwind.config.*` (bez zmian klas)
- Tylko aktualizacja `README.md`, `LESSONS_LEARNED.md`, `AGENTS.md`

### Krok 4 — Selektywne uruchomienie

```bash
# Pojedynczy plik
npx playwright test tests/employee.spec.ts

# Kilka plików
npx playwright test tests/employee.spec.ts tests/housing.spec.ts

# Filtr po tytule testu (gdy zmiana dotyczy konkretnej funkcji)
npx playwright test --grep "dodaj pracownika"

# Cały suite (gdy high-risk)
npx playwright test
```

### Krok 5 — Weryfikacja czystości

Testy Playwright w projekcie nie powinny:
- Używać `sleep()` / `waitForTimeout` bez powodu (reguła #3 QA Agent)
- Modyfikować realnej produkcyjnej Google Sheet — powinny używać test sheet lub mocka
- Zostawiać śmieci po sobie (rezydentów testowych, adresów testowych)

Jeśli zauważysz takie antywzorce **w zmienianych testach** — zgłoś do QA Agent.

## Output dla Orchestratora / Użytkownika

```
REGRESSION_SURFACE_MAP
======================
changed_files: 3
  - src/components/forms/EmployeeForm.tsx
  - src/app/api/employees/stats/route.ts
  - src/lib/actions.ts  (functions: addEmployee, updateEmployee)

recommended_tests:
  MUST run:
    - tests/employee.spec.ts
    - tests/dashboard.spec.ts  (bo actions.ts → shared)
  OPTIONAL:
    - tests/housing.spec.ts  (tylko jeśli dotknięto HousingView)
  SKIP:
    - tests/auth.spec.ts, tests/import.spec.ts, tests/settings.spec.ts

risk_level: medium  (zmiana w actions.ts — shared module)
estimated_duration: ~2 min (2 pliki × 60s avg)

command_to_run:
  npx playwright test tests/employee.spec.ts tests/dashboard.spec.ts

post_test_action:
  Jeśli wszystko zielone → można raportować "gotowe"
  Jeśli czerwone → BLOCKER, zwróć output do orchestratora
```

## Anti-patterns

- ❌ Nie uruchamiaj `npx playwright test` bez mapy (strata czasu)
- ❌ Nie pomijaj testów "bo mała zmiana" gdy dotknięto `actions.ts` / `sheets.ts`
- ❌ Nie raportuj "testy zielone" bez uruchomienia recommended MUST-run setu
- ❌ Nie commituj `.spec.ts` ze `.only` (pomija pozostałe testy w pliku)
