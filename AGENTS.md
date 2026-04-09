# AGENTS.md — Multi-Agent Development System

## Architektura systemu

```text
┌─────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                           │
│              (Główny koordynator zadań)                     │
│  Analyze → Decompose → Assign → Review → Integrate → Ship  │
└──────┬──────────┬──────────┬──────────┬───────────┬────────┘
       │          │          │          │           │
       ▼          ▼          ▼          ▼           ▼
  [FRONTEND]  [BACKEND]  [DATABASE]  [DEVOPS]   [QA]
   Agent        Agent      Agent      Agent     Agent
```

---

## ORCHESTRATOR

**Rola:** Główny architekt i koordynator całego zespołu agentów.

**Odpowiedzialności:**

- Odbiera zadanie od użytkownika i dekompozuje je na podzadania
- Przydziela zadania odpowiednim agentom na podstawie ich specjalizacji
- Ustala kolejność wykonania i zależności między zadaniami
- Integruje wyniki od wszystkich agentów w spójne rozwiązanie
- Weryfikuje jakość końcowego rezultatu przed oddaniem

**Protokół działania:**

```text
1. INTAKE       → Przeanalizuj wymagania. Zadaj pytania doprecyzowujące jeśli potrzeba.
2. DECOMPOSE    → Rozłóż zadanie na atomowe podzadania dla każdego agenta.
3. PLAN         → Zaplanuj kolejność: które agenty działają równolegle, które sekwencyjnie.
4. DISPATCH     → Wyślij instrukcje do agentów z pełnym kontekstem.
5. MONITOR      → Śledź postęp. Obsługuj blokady i konflikty.
6. INTEGRATE    → Połącz wyniki w spójny, działający kod.
7. VALIDATE     → Uruchom QA Agent na zintegrowanym wyniku.
8. DELIVER      → Oddaj gotowe rozwiązanie użytkownikowi.
```

**Reguły orchestratora:**

- Nigdy nie implementuje kodu samodzielnie — deleguje wszystko do agentów
- Przerywa i renegocjuje plan gdy agent zgłosi bloker
- Utrzymuje globalny kontekst projektu (stack, konwencje, zależności)
- Decyduje o priorytetach gdy zasoby agentów kolidują

---

## AGENT: FRONTEND

**Specjalizacja:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, komponenty

**Zakres plików:**

- `src/components/**`
- `src/app/**` (layout, strony, routing)
- `components/**`
- Style, responsywność, animacje

**Protokół działania:**

```typescript
interface FrontendAgentTask {
  // 1. ANALIZA KONTEKSTU
  readExistingComponents: 'Zbadaj istniejące komponenty przed stworzeniem nowych';
  checkDesignSystem: 'Sprawdź shadcn/ui + Tailwind config';
  identifyReusablePatterns: 'Nie duplikuj istniejącej logiki UI';

  // 2. IMPLEMENTACJA
  componentStructure: 'Functional components z TypeScript';
  stateManagement: 'useState/useEffect/custom hooks';
  dataFetching: 'Integracja z Firebase przez istniejące hooki';

  // 3. WERYFIKACJA
  mobileResponsiveness: 'Sprawdź breakpointy mobile/tablet/desktop';
  accessibility: 'ARIA labels, keyboard navigation';
  performance: 'Lazy loading, code splitting';
}
```

**Reguły:**

- Zawsze używaj istniejących komponentów z `components/ui/` przed tworzeniem nowych
- Trzymaj się konwencji nazewnictwa z reszty projektu
- Nie modyfikuj plików backendowych — zgłoś potrzebę do orchestratora

---

## AGENT: BACKEND

**Specjalizacja:** Firebase Functions, API Routes (Next.js), logika biznesowa, autentykacja

**Zakres plików:**

- `src/app/api/**`
- Firebase Functions (jeśli present)
- `lib/**` (utilities, helpers)
- Middleware, autoryzacja

**Protokół działania:**

```typescript
interface BackendAgentTask {
  // 1. ANALIZA
  auditExistingEndpoints: 'Mapuj istniejące API routes';
  securityReview: 'Sprawdź auth guard na każdym endpoincie';
  inputValidation: 'Zod schemas dla każdego request body';

  // 2. IMPLEMENTACJA
  errorHandling: 'Spójne formaty błędów { error, code, details }';
  responseFormat: 'Spójne formaty odpowiedzi { data, meta }';
  firebaseIntegration: 'Używaj admin SDK po stronie serwera';

  // 3. WERYFIKACJA
  authCheck: 'Czy każdy endpoint wymaga uwierzytelnienia?';
  rateLimit: 'Czy krytyczne endpointy mają throttling?';
  logging: 'Czy błędy są logowane z kontekstem?';
}
```

**Reguły:**

- Każdy endpoint musi weryfikować token Firebase Auth
- Nigdy nie zwracaj stack trace do klienta w produkcji
- Nie modyfikuj schemy bazy danych bez synchronizacji z Database Agent

---

## AGENT: DATABASE

**Specjalizacja:** Firestore, struktura kolekcji, zapytania, indeksy, reguły bezpieczeństwa

**Zakres plików:**

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- Wzorce dostępu do danych w `lib/firebase*`

**Protokół działania:**

```typescript
interface DatabaseAgentTask {
  // 1. ANALIZA DANYCH
  mapCollections: 'Udokumentuj istniejące kolekcje i ich pola';
  analyzeAccessPatterns: 'Jakie zapytania są wykonywane najczęściej?';
  reviewIndexes: 'Czy brakuje indeksów dla aktualnych zapytań?';

  // 2. PROJEKTOWANIE
  denormalization: 'Czy warto denormalizować dla wydajności odczytu?';
  subcollections: 'Hierarchia danych vs. płaska struktura';
  batchOperations: 'Grupowanie zapisów w transakcje';

  // 3. BEZPIECZEŃSTWO
  securityRules: 'Reguły Firestore — zasada minimalnych uprawnień';
  dataValidation: 'Walidacja po stronie reguł Firestore';
  auditTrail: 'Timestamps createdAt/updatedAt na każdym dokumencie';
}
```

**Reguły:**

- Każda zmiana schematu musi być wstecznie kompatybilna lub zawierać migrację
- Reguły Firestore muszą być testowane przed deployem
- Nie udostępniaj wrażliwych pól bezpośrednio klientowi — filtruj przez backend

---

## AGENT: DEVOPS

**Specjalizacja:** Firebase Hosting, App Hosting, CI/CD, konfiguracja środowisk, build

**Zakres plików:**

- `firebase.json`
- `apphosting.yaml`
- `next.config.js` / `next.config.mjs`
- `.env*`
- Skrypty w `scripts/`

**Protokół działania:**

```typescript
interface DevOpsAgentTask {
  // 1. ŚRODOWISKO
  envVariables: 'Sprawdź .env.local vs .env.production';
  buildConfig: 'next.config — optymalizacje, rewrites, redirects';
  firebaseConfig: 'Hosting rules, headers, caching';

  // 2. DEPLOYMENT
  buildValidation: 'npm run build musi przejść przed deployem';
  smokeTests: 'Krytyczne ścieżki działają po deployie';
  rollbackPlan: 'Jak cofnąć deploy jeśli coś się posypie?';

  // 3. MONITORING
  errorTracking: 'Czy błędy produkcyjne są zbierane?';
  performanceBudget: 'Core Web Vitals — LCP, FID, CLS';
  firebaseQuotas: 'Monitoruj użycie Firestore/Functions/Hosting';
}
```

**Reguły:**

- Nigdy nie wdrażaj z niesprawdzonym buildem
- Zmienne środowiskowe z sekretami tylko przez Firebase App Hosting secrets
- Każdy deploy musi mieć możliwość rollbacku

---

## AGENT: QA

**Specjalizacja:** Testy jednostkowe (Jest/Vitest), E2E (Playwright), code review, audyty

**Zakres plików:**

- `tests/**`
- `*.test.ts`, `*.spec.ts`
- `playwright.config.ts`
- `jest.config.mjs`, `vitest.config.ts`

**Protokół działania:**

```typescript
interface QAAgentTask {
  // 1. ANALIZA RYZYKA
  identifyCriticalPaths: 'Jakie ścieżki użytkownika są kluczowe?';
  reviewChangedCode: 'Które pliki zostały zmienione przez inne agenty?';
  regressionSurface: 'Które istniejące testy mogą być dotknięte?';

  // 2. TESTOWANIE
  unitTests: 'Logika biznesowa — izolowane testy jednostkowe';
  integrationTests: 'Interakcje komponent ↔ API ↔ Firebase';
  e2eTests: 'Playwright — przepływ użytkownika end-to-end';

  // 3. CODE REVIEW
  securityAudit: 'OWASP Top 10 — XSS, injection, auth bypass';
  performanceReview: 'N+1 queries, unnecessary re-renders';
  accessibilityAudit: 'WCAG 2.1 — kontrast, ARIA, focus management';
}
```

**Reguły:**

- Każda nowa funkcjonalność = minimum jeden test integracyjny
- Zgłoś blokera do orchestratora jeśli coverage spada poniżej progu
- E2E testy muszą być deterministyczne — żadnych `sleep()` bez powodu

---

## Protokół komunikacji między agentami

### Format przekazywania zadania

```text
ORCHESTRATOR → AGENT

TASK_ID: TASK-042
AGENT: Frontend
PRIORITY: high
CONTEXT:
  - Backend Agent stworzył endpoint POST /api/rooms
  - Database Agent zaktualizował schemat kolekcji `rooms`
TASK:
  Stwórz formularz dodawania pokoju w /dashboard/rooms/new.
  Użyj istniejącego komponentu <Dialog> z shadcn/ui.
DEPENDENCIES:
  - Endpoint gotowy: POST /api/rooms → { id, name, type }
  - Typy dostępne w: lib/types/room.ts
ACCEPTANCE_CRITERIA:
  - Formularz waliduje pola (name wymagany, type enum)
  - Po sukcesie redirect do /dashboard/rooms
  - Obsługa błędów z API z toast notification
```

### Format raportu agenta

```text
AGENT → ORCHESTRATOR

TASK_ID: TASK-042
AGENT: Frontend
STATUS: completed | blocked | needs_clarification
FILES_MODIFIED:
  - src/app/dashboard/rooms/new/page.tsx [created]
  - src/components/forms/RoomForm.tsx [created]
BLOCKERS: none
NOTES:
  Użyłem istniejącego hooka useRooms() — nie trzeba tworzyć nowego.
  QA Agent powinien sprawdzić walidację w RoomForm.
NEXT_STEP_FOR_ORCHESTRATOR:
  QA Agent może teraz przetestować formularz.
```

---

## Zasady równoległego wykonywania

```text
RÓWNOLEGLE (bez zależności):
  Frontend Agent + Backend Agent + Database Agent
  → mogą pracować jednocześnie nad różnymi aspektami tej samej funkcji

SEKWENCYJNIE (zależności):
  Database Agent → Backend Agent → Frontend Agent → QA Agent
  → gdy jeden etap zależy od rezultatu poprzedniego
```

**Orchestrator decyduje** na podstawie grafu zależności zadania, które agenty uruchomić równolegle a które w sekwencji.

---

## Protokół uczenia się na błędach

> Każdy agent i Orchestrator **obowiązkowo** stosuje ten protokół w każdej sesji.

### Krok 1 — Przed rozpoczęciem pracy (ZAWSZE)

Przeczytaj [`LESSONS_LEARNED.md`](./LESSONS_LEARNED.md) w całości.
Sprawdź, czy zadanie które masz wykonać nie dotyka obszarów opisanych jako podatne na błędy.

### Krok 2 — W trakcie pracy

Gdy odkryjesz błąd lub niespodziewane zachowanie:

1. Zatrzymaj się i zrozum **dlaczego** do niego doszło (root cause, nie symptom)
2. Oceń, czy podobny błąd może wystąpić gdzie indziej w projekcie
3. Zanotuj go mentalnie — zapiszesz po ukończeniu zadania

### Krok 3 — Po ukończeniu zadania (jeśli znaleziono nowy wzorzec)

Dopisz wpis do `LESSONS_LEARNED.md` w formacie:

```text
### [KATEGORIA] Krótki opis błędu

**Symptom:** Co widział użytkownik / co się psuło
**Root cause:** Dlaczego naprawdę wystąpił błąd
**Rozwiązanie:** Co konkretnie naprawiono i jak
**Obszar ryzyka:** Gdzie jeszcze może wystąpić ten sam wzorzec błędu
**Pliki:** lista plików których dotyczył błąd
```

### Zasady protokołu

- **Nie zapisuj** oczywistych rzeczy (literówki, brakujący import) — tylko wzorce
- **Zapisuj** gdy błąd zaskoczył Cię lub wynikał z interakcji między dwoma mechanizmami
- **Zapisuj** każdy błąd który użytkownik zgłosił jako regresję
- Wpisy są **stałe** — nie usuwaj ich, tylko dopisuj "UPDATE:" jeśli coś się zmieniło
- `LESSONS_LEARNED.md` jest częścią projektu — commit razem z kodem

---

## Reguły całego zespołu

1. **Żaden agent nie modyfikuje plików poza swoim zakresem** bez zgody orchestratora
2. **Każda zmiana musi być zrozumiała** — kod samo-dokumentujący, bez magicznych wartości
3. **Konwencje projektu są wiążące** — nie wprowadzaj nowych wzorców bez decyzji orchestratora
4. **Bloker > guessing** — jeśli agent nie ma pewności, zgłasza blokera zamiast zgadywać
5. **Testy są obowiązkowe** — żaden kod nie trafia do integracji bez weryfikacji przez QA Agent
6. **Security first** — każdy agent sprawdza implikacje bezpieczeństwa swoich zmian
7. **Mobile first** — Frontend Agent zawsze projektuje zaczynając od ekranu mobilnego
8. **🚨 ABSOLUTNY ZAKAZ — Ochrona danych Google Sheets** — Żaden agent nie może pisać kodu kasującego dane z Google Sheets. To jest reguła bezpieczeństwa egzekwowana przez ESLint — naruszenie złamie build.
   - **ZAWSZE** używaj `getSafeSheet()` z `src/lib/safe-sheets.ts` do operacji zapisu
   - **NIGDY** nie wywołuj `row.delete()`, `sheet.clearRows()`, `sheet.deleteRows()` — ESLint zablokuje build
   - **NIGDY** nie kopiuj wzorca `// eslint-disable-next-line no-restricted-syntax` z istniejącego kodu bez pisemnej zgody właściciela
   - Dozwolone operacje: `addRow()`, `updateRowById()`, `addColumnsSafely()`, `getRows()`, `getHeaders()`
   - Jeśli funkcjonalność wymaga usunięcia danych → STOP → zapytaj właściciela przed implementacją
9. **Token first** — każdy agent musi minimalizować zużycie tokenów poprzez precyzyjne zapytania, celowe przeszukiwania i zwięzłe odpowiedzi bez zbędnego wstępu lub zakładowania.

---

## MCP Servers — Rozszerzone możliwości agentów

> Każdy agent może korzystać z poniższych serwerów MCP. Użycie jest opcjonalne, ale **zalecane** przy złożonych zadaniach.

### Dostępne serwery

| Serwer                | Pakiet                                             | Do czego służy                                                                                                   |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `context7`            | `@upstash/context7-mcp`                            | Aktualna dokumentacja Next.js, React, Firebase, Tailwind, TypeScript, shadcn/ui — eliminuje błędy ze starymi API |
| `sequential-thinking` | `@modelcontextprotocol/server-sequential-thinking` | Strukturalne rozwiązywanie złożonych zadań krok po kroku z audytowalnym śladem rozumowania                       |
| `playwright`          | `@playwright/mcp`                                  | Automatyzacja przeglądarki: uruchamianie testów, nawigacja, screenshoty, scraping, wypełnianie formularzy        |
| `github`              | `@modelcontextprotocol/server-github`              | Zarządzanie PR, issues, code review, history — bez opuszczania edytora (wymaga `GITHUB_PERSONAL_ACCESS_TOKEN`)   |

### Jak używać — reguły dla agentów

**FRONTEND Agent:**

- Dodaj `use context7` do promptu gdy używasz Next.js App Router, shadcn/ui lub Tailwind — eliminuje błędy z przestarzałą składnią
- Przykład: _"Stwórz komponent Dialog z shadcn/ui. use context7"_

**BACKEND Agent:**

- Używaj `context7` gdy implementujesz Firebase Admin SDK, Next.js API Routes lub iron-session
- Przykład: _"Skonfiguruj middleware auth dla Next.js 14. use context7"_

**QA Agent:**

- Używaj `playwright` MCP do uruchamiania testów E2E i robienia screenshotów
- Playwright MCP daje dostęp do `browser_navigate`, `browser_screenshot`, `browser_click`, `browser_fill`

**ORCHESTRATOR:**

- Używaj `sequential-thinking` przy dekompozycji złożonych zadań (> 3 agentów, zależności cykliczne)
- Używaj `github` do przeglądania PR, tworzenia issues i weryfikacji historii zmian

**WSZYSTKIE agenty:**

- `github` MCP wymaga zmiennej środowiskowej `GITHUB_PERSONAL_ACCESS_TOKEN` — bez niej serwer działa w trybie read-only dla publicznych repozytoriów

---

## Stack technologiczny (kontekst dla agentów)

| Warstwa     | Technologia                                                    |
| ----------- | -------------------------------------------------------------- |
| Framework   | Next.js 14 (App Router)                                        |
| Język       | TypeScript                                                     |
| Styling     | Tailwind CSS + shadcn/ui                                       |
| Backend     | Next.js API Routes + Firebase Functions                        |
| Baza danych | **Google Sheets** (główna) + Firestore (auth, push, real-time) |
| Auth        | Firebase Authentication                                        |
| Hosting     | Firebase App Hosting                                           |
| Testy       | Jest + Vitest + Playwright                                     |
| Linter      | ESLint                                                         |
