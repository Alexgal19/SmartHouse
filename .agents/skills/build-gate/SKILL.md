---
name: build-gate
description: Use this skill BEFORE declaring any coding task as "gotowe", "done", "finished", "ukończone" in the SmartHouse project. Also invoke before committing, deploying, creating a PR, or merging. Invoke whenever user says "zbuduj", "sprawdź build", "czy działa", "przed commitem", "przed deployem", "gotowe do wdrożenia". This skill runs the full validation pipeline (tsc + lint + build) and blocks completion if anything fails.
---

# Build Gate — Bramka jakości przed oddaniem zadania

## Kontekst

W Next.js App Router `tsc --noEmit` **NIE wystarcza** — kompilator TypeScript nie wykrywa błędów specyficznych dla Next.js (np. błędne typy `page.tsx`, problemy z `"use server"`, błędy w route handlers, konflikty middleware).

Każde zadanie musi przejść **trzy bramki** zanim zostanie ogłoszone jako ukończone.

## Protokół walidacji

Wykonuj w **dokładnie tej kolejności** — nie pomijaj etapów, nie uruchamiaj równolegle (żeby błędy były czytelne).

### Bramka 1 — TypeScript

```bash
npx tsc --noEmit
```

**Kryterium sukcesu:** exit code 0, brak `error TS####`.

Jeśli błędy → **NAPRAW je**, nie obchodź przez `any` / `@ts-ignore` / `@ts-expect-error`. Te ostatnie są dozwolone tylko z komentarzem dlaczego i autoryzacją użytkownika.

### Bramka 2 — ESLint

```bash
npm run lint
```

**Kryterium sukcesu:** exit code 0, brak błędów (warnings OK, ale raportuj).

**Szczególna uwaga:** ESLint w tym projekcie ma regułę `no-restricted-syntax` blokującą `row.delete`, `clearRows`, `deleteRows` (ochrona Google Sheets). Jeśli lint wykryje te wzorce — **nie obchodź przez disable-line**. Przerwij i zgłoś blokera do użytkownika.

### Bramka 3 — Next.js Build

```bash
npm run build
```

**Kryterium sukcesu:** exit code 0, `✓ Compiled successfully`, `✓ Generating static pages`.

**Typowe błędy w Next.js 14 których tsc nie wykryje:**

| Symptom | Typowa przyczyna |
|---|---|
| `Type error: Page "..." does not match` | Błędny typ `params` / `searchParams` w `page.tsx` |
| `Error: Invalid hook call` | `use client` w komponencie serwerowym lub odwrotnie |
| `Module not found` w buildzie (tsc nie widzi) | Błędny alias `@/` lub case sensitivity pliku |
| `Error occurred prerendering page` | Użycie `cookies()` / `headers()` poza route handlerem |
| `Dynamic server usage` | Statyczna strona używająca dynamicznych API |

## Decyzja Go / No-Go

```
WSZYSTKIE 3 BRAMKI ZIELONE → GO ✅
                            → Można raportować "gotowe"
                            → Można commitować
                            → Można deployować

KTÓRAKOLWIEK CZERWONA      → NO-GO ❌
                            → NIE raportuj "gotowe"
                            → NIE commituj
                            → Napraw błędy i uruchom ponownie od Bramki 1
```

## Output dla Orchestratora / Użytkownika

Po każdym uruchomieniu raportuj w formacie:

```
BUILD_GATE_RESULT:
  tsc:    ✅ PASS  (0 errors)
  lint:   ✅ PASS  (0 errors, 2 warnings)
  build:  ✅ PASS  (compiled in 12.3s)
  status: GO
  
  [lub gdy błąd:]
  
  tsc:    ❌ FAIL  (3 errors)
  lint:   —
  build:  —
  status: NO-GO
  next_step: Fix TypeScript errors in src/app/api/employees/route.ts:42
```

## Anti-patterns — czego NIE robić

- ❌ Nie raportuj "gotowe" po samym `tsc --noEmit`
- ❌ Nie pomijaj `npm run build` bo "tylko małe zmiany w UI"
- ❌ Nie używaj `--no-verify` przy commit żeby ominąć hooki
- ❌ Nie dodawaj `eslint-disable` tylko żeby przejść bramki
- ❌ Nie traktuj warnings jako "pass" gdy są nowe (sprawdź `git diff` lintu)

## Gdy build jest długi (>30s)

Uruchom `npm run build` w tle i kontynuuj inne prace tylko jeśli są **niezależne**. Nie ogłaszaj "gotowe" dopóki build się nie skończy.
