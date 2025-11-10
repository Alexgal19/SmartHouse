<<<<<<< HEAD
# Contributing to SmartHouse

This document provides guidelines for both human contributors and AI agents working on SmartHouse. For technical context and architecture details, also see `.github/copilot-instructions.md`.

> **Note:** This document defines working standards for stability, security, accessibility, and code quality with minimal scope changes.

Ten dokument definiuje standardy pracy dla ludzi i AI (Gemini w Firebase Studio) w tym repozytorium. Celem jest maksymalna stabilność, bezpieczeństwo, dostępność i jakość UI/UX przy minimalnym zakresie zmian.
=======
<changes>

<description>Dodano operacyjny AI Operating Prompt, doprecyzowano egzekwowalne reguły (ESLint/tsconfig), granice client/server z 'use server'/'use client', taksonomię błędów i retry/backoff, politykę PII/CSP, ADR/Release/feature flags/rollback, budżety performance jako bramki CI, szablon PR, oraz wzmocnienia dla dat i Empty Handling. Utrzymano istniejącą strukturę i sekcje, rozszerzając dokument o praktyczne, egzekwowalne wytyczne.</description>
  <change>

<file>/CONTRIBUTING.md</file>

<content><![CDATA[

CONTRIBUTING

Ten dokument definiuje standardy pracy dla ludzi i AI (np. Gemini w Firebase Studio) w tym repozytorium. Celem jest maksymalna stabilność, bezpieczeństwo, dostępność i jakość UI/UX przy minimalnym zakresie zmian.
>>>>>>> d03ff35 (wkladka Ustawienia otwierasie zbyt dlugo ja chce 0.2 sec)

Spis treści
1. Zasady ogólne (stabilność i minimalny zakres zmian)
2. Struktura projektu i odpowiedzialności
3. Standardy importów (absolutne aliasy vs ścieżki względne)
4. Zasady dla AI (AI Operating Rules) 4.1 AI Operating Prompt (operacyjne zasady dla AI)
5. Kontrakt wyjściowy AI (AI Output Contract – XML)
6. TypeScript, Lint, Format i Build (wymogi jakości) 6.1 Wymagania tsconfig (aliasy, strict) 6.2 Wymagania ESLint (egzekwowalne reguły)
7. SSR/CSR/Server Actions i bezpieczeństwo sekretów 7.1 Granice client/server i adnotacje ('use server' / 'use client')
8. Integracja z Google Sheets (bezpieczeństwo i niezawodność) 8.1 Retry/Backoff/Timeouts i logowanie
9. UI/UX, A11y i Tailwind
10. Wydajność i budżet performance 10.1 Budżety performance jako bramki CI
11. Testowanie i obserwowalność
12. Checklisty przed PR i przed wdrożeniem
13. Minimalne skrypty (zalecane)
14. Standard pracy z datami (Date Handling) i Excel Export
15. Zasady obsługi pustych pól (Empty/Nullable Handling)
16. Konwencje Git, PR, Commit i Release
17. CODEOWNERS i odpowiedzialności przeglądu
18. Pre-commit i CI (husky, lint-staged, GitHub Actions)
19. Polityka .env, bezpieczeństwo i zarządzanie sekretami 19.1 Polityka PII i redaction 19.2 Nagłówki bezpieczeństwa i CSP
20. Granice architektoniczne (client/server) i reguły ESLint
21. API kontrakty, wersjonowanie i deprecje 21.1 Taksonomia błędów i kontrakt błędów
22. Error handling i zasady UX komunikatów
23. i18n/L10n (internacjonalizacja)
24. Budżety performance i narzędzia CI
25. Accessibility – checklista i testy a11y
26. Strategia testów (unit/component/integration/e2e)
27. Logowanie, obserwowalność i PII/sekrety
28. Onboarding i DX
29. Szablony PR i commit (przykłady)
30. Architektura i budowa aplikacji webowej (guidelines senior)
31. ADR/Decyzje architektoniczne i Feature Flags
32. Rollback plan i wymagane metadane w PR

1. Zasady ogólne (stabilność i minimalny zakres zmian)
• Traktuj każdą zmianę jako krytyczną. Ogranicz zakres do absolutnego minimum wymaganego przez zadanie.
• Nie modyfikuj niepowiązanych komponentów, konfiguracji ani zależności bez wyraźnej potrzeby.
• Każda zmiana musi przejść: lint, typecheck, build oraz lokalne uruchomienie dev.
• Preferuj małe, czytelne PR-y z jasnym opisem i pełnym diffem.
• Zachowuj zgodność z istniejącymi kontraktami typów i API.

2. Struktura projektu i odpowiedzialności
• Logika biznesowa:
• /src/lib/actions.ts – akcje serwerowe (Server Actions/handlers).
• /src/lib/sheets.ts – integracja z Google Sheets.
• Uwaga: te moduły są „server-only” i nie mogą być importowane w kodzie klienckim.
• UI:
• Komponenty ogólne: /src/components/ui
• Komponenty funkcyjne: /src/components
• Globalny stan:
• /src/components/main-layout.tsx – MainLayoutContext (dostarczanie danych i operacji).
• Routing:
• Zgodnie z Next.js (app/ lub pages/ – dopasuj do faktycznej struktury repo).
• Rekomendowana segmentacja lib:
• /src/lib/usecases/** – czysta logika domenowa (bez zależności od UI)
• /src/lib/infra/** – integracje (server-only, np. sheets)
• /src/lib/adapters/** – mapery/DTO/konwersje (transport <-> domena)
• /src/lib/date.ts – helpery dat (kontrakt sekcja 14)

3. Standardy importów (absolutne aliasy vs ścieżki względne)
Priorytety
1. Absolutne aliasy (preferowane): np. import { Foo } from "@/utils/Foo"
2. Względne (lokalne): tylko dla importów z tego samego folderu lub bliskiego sąsiedztwa (max 1–2 poziomy ../)
3. Nigdy: długie łańcuchy ../../../ – w takim wypadku użyj aliasów.

Zasady czystości
• Jeśli istnieje index.ts/tsx w katalogu, importuj katalog (bez /index).
• Pomijaj rozszerzenia plików, jeśli bundler na to pozwala.
• Zmieniaj ścieżki importu tylko, gdy to konieczne. Zweryfikuj, że docelowy plik istnieje i testy przechodzą.

4. Zasady dla AI (AI Operating Rules)
• Minimalny zakres zmian: nie dotykaj plików spoza zakresu zadania; brak szerokich refaktorów bez prośby.
• Pełne pliki: każdą modyfikację zwróć jako kompletny plik w formacie XML (sekcja 5).
• Brak błędów importów i typów: mentalnie zweryfikuj lint/typecheck/build.
• Ścisłe typy: jawne typy/interfejsy; any tylko świadomie z komentarzem.
• Granica klient/serwer: zakaz importu bibliotek serwerowych (google-auth-library, google-spreadsheet) w „use client”.
• Sekrety wyłącznie na serwerze (nigdy NEXT_PUBLIC_*).
• Stabilność: szanuj istniejące API i typy; breaking changes tylko z migracją.
• Performance-first: dynamic import dla ciężkich bibliotek (recharts, xlsx).
• A11y-first: semantyczny HTML, role/aria tylko gdy potrzebne, focus management.

4.1 AI Operating Prompt (operacyjne zasady dla AI)
Cel
• Buduj/modyfikuj aplikację Next.js/React/Node z Google Sheets stabilnie, bezpiecznie i dostępnie, minimalizując zakres zmian i eliminując błędy „związków” (importy, granice client/server, typy, kontrakty API).

Twarde zasady
• Alias importów „@”; bez długich ../../../.
• Daty: używaj wyłącznie "@/lib/date": formatDate, formatDateTime, parseMaybeDate, isValidDate; brak lokalnych formatDate.
• Puste wartości: opcjonalne pola nie są błędem; stosuj ciche fallbacki i normalizację (sekcja 15).
• Walidacja: Server Actions/API walidowane zod; typy przez z.infer; błędy w formacie { code, message, details? }.
• Granice: „use client” nie importuje server-only; sekrety tylko na serwerze.
• Wydajność: dynamic import dla ciężkich bibliotek; kontrola bundla.
• A11y: aria-live dla statusów; brak „undefined/null” w aria-*.

Kontrakty wymagane (sprawdź/utwórz przed zmianami)
• /src/lib/date.ts (sekcja 14.2), /src/lib/sheets.ts (server-only), /src/lib/actions.ts (server-only).
• tsconfig.json: alias „@” -> "./src", "strict": true (+ noImplicitAny, noUncheckedIndexedAccess, exactOptionalPropertyTypes).
• ESLint: reguły granic client/server, aliasów, zakazu lokalnego formatDate.
• package.json: skrypty typecheck, lint:ci, format, format:check, build.
• env.d.ts: typy zmiennych środowiskowych (bez NEXT_PUBLIC dla sekretów).

Format odpowiedzi AI
• Zawsze używaj „AI Output Contract – XML”: pełne pliki w CDATA, ścieżki absolutne, jeden <changes>.

Checklist przed wysłaniem odpowiedzi
• [ ] Minimalny zakres zmian; aliasy „@”; brak ../../../.
• [ ] Brak importów server-only w „use client”; sekrety tylko na serwerze.
• [ ] Walidacja zod; spójny format błędów.
• [ ] Daty: tylko "@/lib/date"; Excel zapisuje stringi; brak lokalnego formatDate.
• [ ] Empty Handling zgodnie z sekcją 15.
• [ ] Mentalnie: npm run lint, typecheck, build.
• [ ] Odpowiedź w XML (pełne pliki w CDATA).

5. Kontrakt wyjściowy AI (AI Output Contract – XML)
Każda propozycja zmiany pliku MUSI być zwrócona w formacie XML poniżej. Każdy zmieniany plik to oddzielny węzeł <change>. Zawartość pliku musi być kompletna (pełny plik), umieszczona w CDATA.

<changes>
  <description>[Krótki opis wprowadzanych zmian]</description>
  <change>
<<<<<<< HEAD
    <file>[ABSOLUTNA, PEŁNA ścieżka do pliku, np. /src/lib/sheets.ts]</file>
    <content><![CDATA[[TUTAJ PEŁNA, FINALNA ZAWARTOŚĆ PLIKU – bez skrótów, bez diffów]
=======

<file>[ABSOLUTNA, PEŁNA ścieżka do pliku, np. /src/lib/sheets.ts]</file>

<content><![CDATA[

[TUTAJ PEŁNA, FINALNA ZAWARTOŚĆ PLIKU – bez skrótów, bez diffów]
]]></content>
  </change>

  <!-- kolejne <change> w razie potrzeby -->

</changes>


Wymogi:
• Używaj absolutnych ścieżek od katalogu repo (np. /CONTRIBUTING.md, /src/components/Button.tsx).
• Nie pomijaj fragmentów (no elisions). Zawsze pełna zawartość.
• Nie dodawaj komentarzy poza strukturą XML.

6. TypeScript, Lint, Format i Build (wymogi jakości)
• TypeScript:
• Preferuj: "strict": true, noImplicitAny, noUncheckedIndexedAccess, exactOptionalPropertyTypes.
• Dodaj typy dla środowiska (env.d.ts) i dla server-only modułów, jeśli użyte.
• ESLint:
• Zgodność z eslint-config-next i @typescript-eslint.
• Wyklucz .next, node_modules, dist, .turbo, coverage.
• Skrypty (zalecane):
• "typecheck": "tsc --noEmit"
• "format": "prettier . --write"
• "format:check": "prettier . --check"
• "lint:ci": "eslint . --max-warnings=0"
• Build:
• Kod musi przejść npm run build bez błędów i krytycznych ostrzeżeń.
• Nie dopuszczaj do importu serwerowych bibliotek po stronie klienta.

6.1 Wymagania tsconfig (aliasy, strict)
• baseUrl: "./src"
• paths: { "@/": [""] }
• compilerOptions: "strict": true, "noImplicitAny": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true
• Zmiana aliasów wymaga aktualizacji ESLint i dokumentacji.

6.2 Wymagania ESLint (egzekwowalne reguły)
• Zakaz importów server-only (google-spreadsheet, google-auth-library, moduły z /src/lib/infra, /src/lib/sheets.ts, /src/lib/actions.ts) w plikach z "use client".
• Preferencja aliasów „@” nad długimi ścieżkami względnymi (no-restricted-imports / custom rule).
• Blokuj użycie „formatDate(” bez importu z "@/lib/date" i redefinicję „function formatDate(” poza /src/lib/date.ts.
• next/core-web-vitals, @typescript-eslint/recommended, import/order (grupowanie aliasów), no-restricted-paths dla granic warstw.

7. SSR/CSR/Server Actions i bezpieczeństwo sekretów
• Sekrety i biblioteki serwerowe (google-auth-library, google-spreadsheet) – tylko w środowisku serwerowym (API routes, Server Actions, route handlers).
• Nigdy nie używaj NEXT_PUBLIC_* dla sekretów.
• Waliduj dane wejściowe po stronie serwera (zod) i zwracaj kontrolowane błędy (status, message).
• Rozważ retry/backoff dla 429/5xx. Loguj błędy z kontekstem (bez wrażliwych danych).

7.1 Granice client/server i adnotacje
• „use server” w modułach server-only (Server Actions, infra).
• „use client” tylko gdy konieczne (interakcje, stan).
• Pliki z „use client” nie mogą importować:
• /src/lib/sheets.ts, /src/lib/actions.ts, modułów zależnych od google-*, ani innych server-only.

8. Integracja z Google Sheets (bezpieczeństwo i niezawodność)
• Uwierzytelnianie: Service Account; poświadczenia w env (np. JSON base64 dekodowany na serwerze).
• Uprawnienia: upewnij się, że SA ma dostęp do arkuszy.
• Izolacja: /src/lib/sheets.ts nie może być importowany w kliencie.
• Obsługa błędów: odróżniaj 4xx/5xx; ostrożny retry/backoff; czytelne komunikaty dla UI; szczegóły loguj na serwerze.
• Walidacja: wejścia waliduj zod; nie ufaj klientowi.

8.1 Retry/Backoff/Timeouts i logowanie
• Exponential backoff dla 429/5xx: np. 100ms, 300ms, 1s, 3s (max 4 próby).
• Per-request timeout: np. 10s (dostosuj do domeny).
• Logowanie: kontekst (requestId, userId jeśli istnieje), bez PII/sekretów, redaction w logach.

9. UI/UX, A11y i Tailwind
• A11y: semantyczne HTML5; aria-live dla statusów; role/aria tylko gdy konieczne.
• Tailwind: mobile-first; sensowne breakpoints; unikanie FOUC/CLS; content w tailwind.config obejmuje app/, src/, components/**.
• Animacje: transform/opacity (GPU-friendly); subtelne micro-interactions.
• Formularze: react-hook-form + zodResolver; walidacja powtórzona na serwerze.

10. Wydajność i budżet performance
• Code splitting i dynamic import dla ciężkich bibliotek (recharts, xlsx) i rzadkich widoków.
• Lazy-load obrazów i komponentów poza viewportem.
• Unikaj zbędnych re-renderów (memo/useCallback/useMemo sensownie).
• Kontroluj wagę bundla; eliminuj nieużywane zależności/importy.
• Preload/preconnect krytycznych zasobów, gdy uzasadnione.

10.1 Budżety performance jako bramki CI
• Budżety (orientacyjne): LCP < 2.5s, CLS < 0.1, TBT < 200ms, JS per route < 200kB gz.
• CI: Lighthouse CI i next-bundle-analyzer; anotacje w PR przy przekroczeniach (soft fail z uzasadnieniem lub hard fail dla regresji > ustalony próg).

11. Testowanie i obserwowalność
• Testy: smoke tests dla krytycznych komponentów/flow; walidacja schematów zod (przykłady dobry/zły).
• Obserwowalność: logi po stronie serwera z kontekstem; spójny format błędów API; bez logowania sekretów.

12. Checklisty

Przed wysłaniem PR
• [ ] Zmiany ograniczone do wymaganych plików.
• [ ] Kod przechodzi npm run lint, npm run typecheck, npm run build.
• [ ] Brak importów serwerowych w kliencie.
• [ ] Zgodność ze standardami importów (aliasy > relatywne).
• [ ] Walidacja danych (zod) dla endpointów/API.
• [ ] UI/A11y sprawdzone (klawiatura, aria, kontrasty).
• [ ] Dynamic import dla ciężkich modułów, jeśli dotyczy.
• [ ] Dołączono plan rollback (dla większych/ryzykownych zmian) i ewentualne feature flags.

Przed wdrożeniem
• [ ] Zmienne środowiskowe ustawione (bez sekretów w NEXT_PUBLIC_*).
• [ ] Dostępy Service Account do Google Sheets zweryfikowane.
• [ ] Monitoring/logi działają, błędy raportują się poprawnie.
• [ ] Brak ostrzeżeń krytycznych w buildzie.
• [ ] Wydajność i rozmiar bundla akceptowalne.
• [ ] ADR zaktualizowane dla zmian architektonicznych.

13. Minimalne skrypty (zalecane w package.json)
• "typecheck": "tsc --noEmit"
• "format": "prettier . --write"
• "format:check": "prettier . --check"
• "lint:ci": "eslint . --max-warnings=0"
• (zalecane dodatkowe) "lint:fix": "eslint . --fix", "analyze": "ANALYZE=true next build", "test:coverage": "vitest run --coverage" (lub odpowiednik)

14.1 Zasady ogólne (daty)
• Centralizacja: wszystkie operacje na datach przez helpery w /src/lib/date.ts.
• Zakazane: lokalne formatDate; jeśli potrzebujesz formatowania – użyj funkcji z /src/lib/date.ts.
• Biblioteka: date-fns; używaj format; helpery wrapują format i parsowanie.
• Typy: operuj na Date lub bezpiecznie parsuj string/number do Date przed formatowaniem.

14.2 Kontrakt helperów (musi istnieć plik /src/lib/date.ts)
• formatDate(input: Date | string | number, pattern?: string): string (domyślnie "yyyy-MM-dd")
• formatDateTime(input: Date | string | number, pattern?: string): string (domyślnie "yyyy-MM-dd HH:mm")
• parseMaybeDate(input: Date | string | number): Date | null (bez wyjątków)
• isValidDate(input: unknown): boolean (true dla poprawnego Date i nie-NaN)
• Wszyscy konsumenci (UI, API, export do Excela) importują wyłącznie z "@/lib/date".

14.3 Zasady użycia w Excel Export (xlsx)
• Daty do Excela zapisuj jako sformatowane stringi (formatDate/formatDateTime). Zalecane: "dd.MM.yyyy" i "dd.MM.yyyy HH:mm".
• Stringowe daty zawsze parsuj (parseMaybeDate), w razie niepoprawnej – pusty string lub oznaczenie w raporcie.
• Zabronione: lokalne funkcje formatDate; zawsze importuj z "@/lib/date".
• Spójność kolumn: jeden format na kolumnę.

14.4 Reguły dla AI (dot. dat i Excela)
• Jeśli widzisz wywołanie formatDate bez importu z "@/lib/date" – dodaj import i użyj helpera.
• Jeśli helper nie istnieje – najpierw utwórz /src/lib/date.ts (sekcja 14.2), potem modyfikuj eksport.
• Nie zamieniaj formatDate na nieistniejące funkcje date-fns (używaj format przez helpery).
• Zweryfikuj alias "@/lib/date" i przejście lint/typecheck/build.

14.5 Checklist (daty/Excel)
• [ ] /src/lib/date.ts eksportuje: formatDate, formatDateTime, parseMaybeDate, isValidDate.
• [ ] Wszędzie użyto helperów z "@/lib/date".
• [ ] Stringowe daty parsowane; nieprzetwarzalne → puste.
• [ ] Spójne formaty w Excelu.
• [ ] Brak lokalnych formatDate w innych plikach.

Co jeszcze warto dodać do repo (opcjonalne, ale polecane)
• ESLint rule/grep w CI: blokuj „formatDate(” bez importu z "@/lib/date"; blokuj redefinicję „function formatDate(” poza /src/lib/date.ts.
• Testy jednostkowe dla /src/lib/date.ts: poprawne formatowanie ISO/string/number; zachowanie na niepoprawnych (null, "abc", NaN).
• Dokumentacja przykładów w README (jak formatować daty i importować helpery).

15. Empty/Nullable Handling – zasady 5.1 Definicje i ogólne zasady
• Dozwolone stany puste: null, undefined, "" (po trim).
• Puste pole nie generuje błędu, chyba że jest required.
• Normalizacja: teksty trim; puste → "" lub null wg kontekstu.
• Konsekwencja w całej aplikacji.

15.2 Walidacja (zod) – kontrakt
• Pola opcjonalne:
• z.string().optional().transform(v => (v?.trim() ? v.trim() : "")) lub transform do null.
• Pola wymagane:
• z.string().min(1, "Pole wymagane") po trim/transform.
• Daty opcjonalne:
• z.union([z.string(), z.date()]).optional().transform(v => { if (!v) return null; /* parseISO/new Date; niepoprawne → null */ })
• Nigdy nie rzucaj błędu dlatego, że optional jest puste.

15.3 UI (formularze i widoki)
• Brak błędów walidacji dla pustych optional.
• Placeholdery dla pustych wartości.
• A11y: brak "undefined"/"null" w aria-*; sensowne fallbacki ("Brak danych").

15.4 Excel Export (xlsx) – puste pola
• Tekst: puste → "" (lub "—" jeśli wizualnie wymagane).
• Daty: parseMaybeDate === null → "" (nie formatuj).
• Liczby: optional i brak → "" (nie 0, chyba że domena tak wymaga).
• Wymagane kolumny: nie przerywaj eksportu; wpisz "" i dołącz ostrzeżenie (log/metadane).

15.5 Backend/API
• Normalizuj puste wejścia: "" / null zgodnie z modelem.
• Waliduj zod; opcjonalne pola nie generują błędów.
• Nie zwracaj 4xx za puste optional.
• Loguj tylko nieoczekiwane błędy; bez PII/sekretów.

15.6 Reguły dla AI (Empty Handling)
• Usuń błędy dla pustych optional; zastosuj normalizację + cichy fallback.
• Format dat: puste/nieparsowalne → "" bez toast error.
• Excel: nigdy nie przerywaj przez puste pola.
• Zweryfikuj schematy zod dot. optional.

15.7 Checklist (Empty/Nullable)
• [ ] Schematy zod rozróżniają required vs optional i nie zwracają błędów dla pustych optional.
• [ ] UI nie pokazuje toasts dla pustych optional.
• [ ] Excel zapisuje "" dla pustych optional (teksty/liczby/daty).
• [ ] parseMaybeDate → null dla pustych/nieparsowalnych; formatDate → "" dla null.
• [ ] Flow nie przerywa się przez puste optional.

16. Konwencje Git, PR, Commit i Release
• Branch naming: feature/<ticket-id>-opis, fix/<ticket-id>-..., chore/<opis>, docs/<opis>, refactor/<opis>, perf/<opis>, build/<opis>, ci/<opis>.
• Conventional Commits. Dodawaj kontekst (ticket/link) w body.
• PR: min. 1–2 review (CODEOWNERS), zielony CI jako warunek merge, squash merge domyślny.
• Zakaz WIP na main. Draft PR do dyskusji.
• Release: SemVer; changelog (changesets/conventional-changelog); tagi vX.Y.Z; Release PR przechodzi pełny CI.

17. CODEOWNERS i odpowiedzialności przeglądu
• /src/lib/** – właściciele back-end/server-only
• /src/components/** – właściciele UI
• /src/lib/sheets.ts – integracje zewnętrzne
• /src/lib/date.ts – kontrakt dat
• /app/** lub /pages/** – routing

18. Pre-commit i CI (husky, lint-staged, GitHub Actions)
• pre-commit: prettier + eslint + szybki typecheck na staged (lint-staged).
• pre-push: test + lint + typecheck.
• CI: install + cache, lint, typecheck, build, test (unit), e2e (opcjonalnie), a11y (opcjonalnie), Lighthouse CI (opcjonalnie).
• Blokuj merge przy czerwonym CI; lint warnings: 0.

19. Polityka .env, bezpieczeństwo i zarządzanie sekretami
• Nigdy NEXT_PUBLIC_* dla sekretów.
• .env.local (lokalnie), .env.example (bez sekretów).
• Rotacja sekretów i least privilege dla SA.
• Redaction sekretów/PII w logach.

19.1 Polityka PII i redaction
• Zidentyfikuj PII (np. imię, nazwisko, email, telefon – dostosuj do domeny).
• Nie loguj PII; jeśli konieczne – stosuj maskowanie.
• Zakaz przechowywania PII w analytics bez zgody i minimalizacji.

19.2 Nagłówki bezpieczeństwa i CSP
• Włącz CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
• CSP w dev z raportowaniem; unikaj inline scriptów bez nonce.

20. Granice architektoniczne (client/server) i reguły ESLint
• Zakaz importów server-only w „use client”.
• Wymuś przez ESLint (import/no-restricted-paths, custom rules).
• Oddzielne katalogi na „server-only” i „client-only” oraz jasne entrypoints.

21. API kontrakty, wersjonowanie i deprecje
• zod jako źródło prawdy dla request/response; TS typy przez z.infer.
• Spójny format błędów: { code, message, details? } + status HTTP.
• Wersjonuj API (v1, v2). Oznaczaj @deprecated i zapewnij okres przejściowy.

21.1 Taksonomia błędów i kontrakt błędów
• Kody: VALIDATION_ERROR, AUTH_ERROR, PERMISSION_DENIED, NOT_FOUND, RATE_LIMIT, UPSTREAM_ERROR, INTERNAL_ERROR.
• UI: walidacja inline (aria-live="polite"); systemowe błędy w toast/alert zrozumiałe dla użytkownika.

22. Error handling i zasady UX komunikatów
• Nie wyświetlaj alertów dla pustych optional.
• Global error boundary, fallback UI i raportowanie na serwerze (bez PII).

23. i18n/L10n (internacjonalizacja)
• Brak hardcoded tekstów w komponentach – używaj warstwy i18n.
• Fallbacki językowe; atrybut lang na html; daty/liczby wg locale (jeśli wymagane).

24. Budżety performance i narzędzia CI
• Lighthouse CI na PR (artefakt).
• next-bundle-analyzer – porównanie rozmiarów bundla.
• Anotacje w PR przy przekroczeniach (soft fail z uzasadnieniem).

25. Accessibility – checklista i testy a11y
• Focus visible, skip links, poprawna kolejność fokusa.
• Semantyczne role, label-associations, alt dla obrazów.
• Kontrast WCAG AA, aria-live dla statusów.
• Klawiatura: interakcje dostępne bez myszy.
• Testy axe dla krytycznych widoków (opcjonalnie w CI).

26. Strategia testów (unit/component/integration/e2e)
• Unit: helpery (w tym /src/lib/date.ts), walidacje zod.
• Component: RTL – zachowania i a11y.
• Integration: Server Actions/route handlers z mockami zewnętrznych usług.
• E2E: Playwright/Cypress dla krytycznych flow (logowanie, formularze, eksport).
• Snapshoty tylko dla stabilnych, mało zmiennych UI.

27. Logowanie, obserwowalność i PII/sekrety
• Poziomy logów: debug/info/warn/error. Korelacja request id.
• Redaction sekretów/PII. Sampling dla dużego ruchu.
• Raportowanie błędów po stronie serwera z kontekstem (bez sekretów).

28. Onboarding i DX
• Wymagania: wersja Node, menedżer pakietów.
• Kroki uruchomienia: instalacja, .env.local wg .env.example, komendy dev/lint/typecheck/build/test.
• Alias @ i struktura katalogów – przypomnienie.
• Jak uruchomić testy i e2e, jak odpalić bundle analyzer.

29. Szablony PR i commit (przykłady)
• PR:
• Tytuł: [feat|fix|chore|refactor|perf|docs] Krótki opis (ticket-id)
• Opis: Cel, Zakres, Zmiany, Jak testować, Checklisty, Ryzyka/Rollback, Feature flags?, ADR link?, Performance, Security.
• Commit:
• feat(ui): dodaj walidację formularza pracownika (ABC-123)
• fix(api): popraw błędny status w handlerze eksportu (ABC-456)
• chore(deps): aktualizacja date-fns do 3.x (bez zmian w API)

30. Architektura i budowa aplikacji webowej (guidelines senior) 30.1 Filary
• Czytelność > spryt; prostota > złożoność; jawne kontrakty > ukryte zależności; bezpieczeństwo i dostępność „by default”.
• SoC, DI (przez parametry/fabryki), kompozycja ponad dziedziczenie, modularność.

30.2 Warstwy i granice
• Prezentacja (UI): komponenty czyste; „client-only” wyłącznie jeśli potrzebne.
• Aplikacja: routing, layouty, providers, stan UI.
• Domenowa logika: /src/lib/usecases/** – czyste funkcje/async.
• Infrastruktura: /src/lib/infra/** – integracje (server-only).
• Kontrakty: typy, zod schematy, DTO, mapery, adaptery.
• Zasada: w górę importujemy tylko kontrakty/interfejsy; implementacje wstrzykujemy.

30.3 Przepływy danych (Next.js)
• SSR/SSG/RSC: preferuj server components dla fetch/ciężkich operacji; klient tylko dla interakcji.
• Server Actions: waliduj wejście (zod), zwracaj ustrukturyzowany wynik; loguj błędy.
• Route Handlers/API: czyste endpointy; 1 miejsce walidacji/mapowania.
• Client: minimalny global state; preferuj lokalny stan i serwer jako źródło prawdy.

30.4 Kontrakty i walidacja
• zod jako jedyne źródło prawdy; typy przez z.infer.
• DTO/mappery: rozdziel transport (Sheets/API) od domeny.
• Format błędów: { code, message, details? } – nie mieszaj formatów.

30.5 Komponenty UI
• SRP; prezentacyjne vs kontenerowe; dostępność (role/aria/focus).
• Tailwind utility-first; ekstrakcja wzorców do prymitywów UI.

30.6 Stan i efekty
• Unikaj global state; preferuj RSC + lokalny stan.
• useEffect tylko dla niezbędnych efektów; poprawne deps.
• Memoizacja: gdy mierzalnie poprawia render.

30.7 Integracje i I/O
• Izoluj w infra; retry/backoff/timeouts; loguj kontekst bez PII.

30.8 Bezpieczeństwo
• Least privilege; brak sekretów w kliencie; CSP i nagłówki; walidacja i sanitacja; ochrona SSRF/XSS/CSRF; brak eval.

30.9 Wydajność
• Minimalizuj JS na kliencie; RSC/SSR; dynamic import dla ciężkich pakietów; obrazy: optymalizacja/lazy/rozmiary; preconnect.

30.10 Decyzje architektoniczne (ADR)
• Rejestruj kluczowe decyzje (docs/adr/NNN-nazwa.md): kontekst, opcje, decyzja, konsekwencje.
• Zmiana architektury = aktualizacja ADR + migracja.

30.11 Antywzorce – zakazane
• „God objects”; „utils.ts” jako śmietnik; importy łamiące granice; side-effects w komponentach prezentacyjnych; ukryte singletony; łańcuchy ../../../ zamiast aliasów.

30.12 Przykładowa struktura (do adaptacji)
• src/
• app/ lub pages/ – routing, layouty (server-first)
• components/
• ui/ – prymitywy UI

• [feature]/ – komponenty feature’owe

• lib/
• usecases/ – logika domenowa

• adapters/ – mapery/DTO

• infra/ – integracje (server-only, np. sheets.ts)

• date.ts – helpery dat (sekcja 14)

• actions.ts – Server Actions (zod, obsługa błędów)

• styles/, hooks/, types/
• tests/ – unit/component/integration
• e2e/ – testy end-to-end
• docs/adr/ – decyzje architektoniczne

30.13 Checklist architektoniczny
• [ ] Warstwy rozdzielone (UI vs domena vs infrastruktura)?
• [ ] Kontrakty (zod/typy) jedynym źródłem prawdy?
• [ ] Importy respektują granice (client/server, domena/infra)?
• [ ] Błędy jednolicie formatowane i obsługiwane?
• [ ] Budżety performance i a11y spełnione?
• [ ] Decyzje udokumentowane (ADR)?

31. ADR i Feature Flags
• Każda zmiana granic/wzorca architektonicznego wymaga ADR (docs/adr/).
• Feature flags dla ryzykownych zmian; rollout per env; domyślnie bezpieczny stan; dokumentuj w PR.

32. Rollback plan i wymagane metadane w PR
• PR większy/ryzykowny musi zawierać: plan rollback (jak, kiedy, skutki), informacje o feature flags, link do ADR (jeśli dotyczy), wpływ na performance i bezpieczeństwo.

Uwagi końcowe
• Jeśli zadanie wymaga zmiany struktur danych lub API, opisz migrację i wpływ na istniejące ekrany/komponenty.
• Preferuj przejrzystość nad „sprytem”. Kod ma być łatwy w utrzymaniu przez zespół.

]]></content>
  </change>

</changes>
>>>>>>> d03ff35 (wkladka Ustawienia otwierasie zbyt dlugo ja chce 0.2 sec)
