---
name: preflight-check
description: Use this skill at the START of any non-trivial coding session in SmartHouse — before writing code, before implementing a feature, before fixing a bug. Invoke when user says "zacznij", "zaimplementuj", "napraw", "dodaj funkcję", "dodaj feature", "zmień", "refaktor", or any task requiring more than 1 file change. This skill gathers project state (git, dependencies, recent commits, relevant lessons) to prevent wasted work and surprise regressions.
---

# Preflight Check — Zbieranie kontekstu przed startem

## Kontekst

Większość błędów w SmartHouse wynika z **braku kontekstu** na starcie — agent nie wie, że coś jest w trakcie, że inny agent już pracuje nad plikiem, albo że podobny problem został już rozwiązany. Ten skill zbiera niezbędne informacje **zanim** zaczniesz pisać kod.

## Protokół preflight

Wykonaj **w kolejności**. Zatrzymaj się na blokerach.

### Krok 1 — Stan repozytorium

```bash
git status --short
git log --oneline -10
git diff --stat HEAD
```

**Interpretacja:**
- Brudny working directory → zapytaj czy kontynuować na tej zmianie czy zacząć od czysto
- Niepushowane commity → odnotuj, ale nie blokuj
- Aktualny branch != `main` → odnotuj kontekst branchu

### Krok 2 — Świeżość zależności

```bash
test -f package-lock.json && npm ls --depth=0 2>&1 | grep -E "UNMET|missing" || echo "deps OK"
```

Jeśli brakujące zależności → uruchom `npm install` przed kontynuacją.

### Krok 3 — Relevantne lekcje z LESSONS_LEARNED.md

Przeczytaj [LESSONS_LEARNED.md](../../../LESSONS_LEARNED.md) i wynajdź wpisy dotyczące:

- Plików które będziesz modyfikował
- Mechanizmów których będziesz używać (auth, sheets, push, Firebase)
- Podobnej funkcjonalności już zaimplementowanej

Jeśli znajdziesz matching entry — **przytocz go w raporcie** i zastosuj wnioski.

### Krok 4 — Pamięć CLAUDE (projektu)

Przeczytaj wpisy z `MEMORY.md`:
- `project_smarthouse_overview.md` — architektura
- `feedback_check_existing_functions.md` — `actions.ts` (2267 linii) i `sheets.ts` (862) mają większość logiki
- `feedback_follow_existing_patterns.md` — szukaj istniejących wzorców przed tworzeniem nowych
- `feedback_polish_language.md` — wszystko user-facing po polsku
- `feedback_api_auth_required.md` — każde API route wymaga auth

### Krok 5 — Identyfikacja dotkniętych obszarów

Na podstawie opisu zadania zmapuj:

| Obszar zadania | Pliki do przeczytania PRZED implementacją |
|---|---|
| Dodanie formularza / widoku | `src/components/forms/*`, `components/ui/*` |
| Dodanie endpointa API | istniejący endpoint z tym samym wzorcem auth |
| Zmiana w Google Sheets | [src/lib/sheets.ts](../../../src/lib/sheets.ts), [src/lib/safe-sheets.ts](../../../src/lib/safe-sheets.ts) |
| Logika biznesowa | [src/lib/actions.ts](../../../src/lib/actions.ts) |
| Typy | [src/types.ts](../../../src/types.ts) |
| Powiadomienia push | `src/app/api/push/*`, `lib/push/*` |
| Auth / sesja | `src/lib/auth.ts`, `src/middleware.ts` |
| Cron / alerty | [src/app/api/alerts/route.ts](../../../src/app/api/alerts/route.ts), `src/lib/alert-utils.ts` |

### Krok 6 — Identyfikacja ról agentów

Zdecyduj który agent (Frontend / Backend / Database / DevOps / QA) powinien wykonać zadanie lub każdy jego element. Jeśli zadanie dotyka wielu agentów — orchestrator musi zdecydować o kolejności.

### Krok 7 — Check aktywnych konfliktów

```bash
# Czy ktoś inny (lub Ty w innej sesji) edytuje te same pliki?
git diff HEAD --name-only
git stash list
```

Jeśli są nieoczekiwane zmiany — **zapytaj użytkownika** zanim coś nadpiszesz. Nigdy nie rób `git stash pop` ani `git checkout .` bez zgody.

## Output dla użytkownika

Zwróć zwięzły raport **przed** rozpoczęciem implementacji:

```
PREFLIGHT REPORT
================
branch: main (clean)
last_commit: fa63fb91 fix: powiadomienia — admin widzi tylko dodanie...

relevant_lessons:
  - LESSONS_LEARNED.md#auth-firebase-token-refresh (dotyczy bieżącego zadania)
  - feedback_check_existing_functions.md (actions.ts ma już podobną logikę)

scope_mapping:
  agent_role: Backend + Frontend (sekwencyjnie)
  files_to_read_first:
    - src/lib/actions.ts (linie 1200-1300 — podobna funkcja)
    - src/types.ts (sekcja Employee)
  files_to_modify:
    - src/app/api/employees/route.ts
    - src/components/forms/EmployeeForm.tsx

risks:
  - Zmiana w actions.ts dotyka także alertów cron (zależność)

plan_confidence: high | medium | low

NEXT_STEP: [opisz pierwszy konkretny krok]
```

## Zasady preflightu

- **NIE pomijaj** tego skilla nawet dla "prostych" zadań > 1 plik
- **Zatrzymaj się** jeśli git jest w nieoczekiwanym stanie (rebase w toku, merge conflict)
- **Nie zgaduj** — jeśli po preflightcie wciąż nie wiesz co zrobić, zapytaj użytkownika
- **Aktualizuj LESSONS_LEARNED.md** po zakończeniu zadania jeśli napotkałeś nowy wzorzec
