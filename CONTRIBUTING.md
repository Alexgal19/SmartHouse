<<<<<<< HEAD
# Contributing to SmartHouse

This document provides guidelines for both human contributors and AI agents working on SmartHouse. For technical context and architecture details, also see `.github/copilot-instructions.md`.

> **Note:** This document defines working standards for stability, security, accessibility, and code quality with minimal scope changes.
=======
<changes>

<description>Wdrożenie opcji 2: rozszerzony CONTRIBUTING.md􀰓 + egzekwowalność. Dodano sekcje Safe Collections (.map/.filter/.reduce), RHF defaultValues, redirecty w dev, checklisty PR, oraz wskazówki ESLint/CI i grep do wychwytywania niebezpiecznych wzorców. Dokument pozostaje neutralny względem narzędzi, ale zawiera precyzyjne reguły i kontrakty, które AI i zespół muszą spełnić.</description>
  <change>

<file>/CONTRIBUTING.md</file>

<content><![CDATA[

Ten dokument definiuje standardy pracy dla ludzi i AI (Gemini w Firebase Studio) w tym repozytorium. Celem jest maksymalna stabilność, bezpieczeństwo, dostępność i jakość UI/UX przy minimalnym zakresie zmian.
>>>>>>> 8f2bca7 (a teraz nadaj odpowiedz czemu z Google sheet wyciagnelo tylko 65 wierszy)

Spis treści
1. Zasady ogólne (stabilność i minimalny zakres zmian)
2. Struktura projektu i odpowiedzialności
3. Standardy importów (absolutne aliasy vs ścieżki względne)
4. Zasady dla AI (AI Operating Rules)
5. Kontrakt wyjściowy AI (AI Output Contract – XML)
6. TypeScript, Lint, Format i Build (wymogi jakości)
7. SSR/CSR/Server Actions i bezpieczeństwo sekretów 7.A Redirecty w Next.js (diagnostyka i guardy w dev)
8. Integracja z Google Sheets (bezpieczeństwo i niezawodność)
9. UI/UX, A11y i Tailwind
10. Wydajność i budżet performance
11. Testowanie i obserwowalność 11.A React Hook Form – defaultValues i puste kolekcje
12. Checklisty przed PR i przed wdrożeniem 12.A Checklista Safe Collections (.map/.filter/.reduce)
13. Minimalne skrypty (zalecane)
14. Standard pracy z datami (Date Handling) i Excel Export
15. Zasady obsługi pustych pól (Empty/Nullable Handling) 15.A Safe Collections – zasady dla .map/.filter/.reduce
16. Konwencje Git, PR, Commit i Release
17. CODEOWNERS i odpowiedzialności przeglądu
18. Pre-commit i CI (husky, lint-staged, GitHub Actions)
19. Polityka .env, bezpieczeństwo i zarządzanie sekretami
20. Granice architektoniczne (client/server) i reguły ESLint 20.A ESLint/CI – wykrywanie niebezpiecznych .map i braków defaultValues
21. API kontrakty, wersjonowanie i deprecje
22. Error handling i zasady UX komunikatów
23. i18n/L10n (internacjonalizacja)
24. Budżety performance i narzędzia CI
25. Accessibility – checklista i testy a11y
26. Strategia testów (unit/component/integration/e2e)
27. Logowanie, obserwowalność i PII/sekrety
28. Onboarding i DX
29. Szablony PR i commit (przykłady)
30. Architektura i budowa aplikacji webowej (guidelines senior)

1. Zasady ogólne (stabilność i minimalny zakres zmian)
• Traktuj każdą zmianę jako krytyczną. Ogranicz zakres do absolutnego minimum wymaganego przez zadanie.
• Nie modyfikuj niepowiązanych komponentów, konfiguracji ani zależności bez wyraźnej potrzeby.
• Każda zmiana musi przejść: lint, typecheck, build oraz lokalne uruchomienie dev.
• Preferuj małe, czytelne PR-y z jasnym opisem i pełnym diffem.
• Zachowuj zgodność z istniejącymi kontraktami typów i API.

2. Struktura projektu i odpowiedzialności
• Logika biznesowa:
• src/lib/actions.ts – akcje serwerowe (Server Actions/handlers).
• src/lib/sheets.ts – integracja z Google Sheets.
• Uwaga: te moduły są „server-only” i nie mogą być importowane w kodzie klienckim.
• UI:
• Komponenty ogólne: src/components/ui
• Komponenty funkcyjne: src/components
• Globalny stan:
• src/components/main-layout.tsx – MainLayoutContext (dostarczanie danych i operacji, np. handleUpdateSettings, handleAddEmployee).
• Routing:
• Zgodnie z Next.js (app/ lub pages/ – dopasuj do faktycznej struktury repo).

3. Standardy importów (absolutne aliasy vs ścieżki względne)
Priorytety
1. Absolutne aliasy (preferowane): np. import { Foo } z '@/utils/Foo'
2. Względne (lokalne): tylko dla importów z tego samego folderu lub bliskiego sąsiedztwa (max 1–2 poziomy ../)
3. Nigdy: długie łańcuchy ../../../ – w takim wypadku użyj aliasów.

Zasady czystości
• Jeśli istnieje index.ts/tsx w katalogu, importuj katalog (bez /index).
• Pomijaj rozszerzenia plików, jeśli bundler na to pozwala.
• Zmieniaj ścieżki importu tylko, gdy to konieczne (np. przenoszenie pliku). Zweryfikuj, że docelowy plik istnieje i że wszystkie testy przechodzą.

4. Zasady dla AI (AI Operating Rules)
• Minimalny zakres zmian:
• Nie dotykaj plików spoza zakresu zadania.
• Nie refaktoryzuj szeroko bez wyraźnej prośby.
• Pełne pliki:
• Gdy zmieniasz plik, zwróć całą finalną zawartość pliku (bez diffów), w formacie XML opisanym w sekcji 5.
• Brak błędów importów:
• Nie generuj kodu, który spowoduje „Module not found” lub błędy rozwiązywania typów.
• Walidacja lokalna (wewnętrzna):
• Przed wysłaniem odpowiedzi mentalnie „uruchom” npm run lint, npm run typecheck, npm run build. Kod musi przejść.
• Ścisłe typy:
• Używaj jawnych typów i interfejsów. Unikaj any, chyba że to świadoma, uzasadniona decyzja z komentarzem.
• Granica klient/serwer:
• Nie importuj bibliotek serwerowych (google-auth-library, google-spreadsheet) w komponentach klienckich („use client”).
• Wszelka praca z sekretami – wyłącznie na serwerze.
• Stabilność i zgodność:
• Szanuj istniejące API komponentów i kontrakty typów. Zmiany łamiące wprowadzaj tylko po uzasadnieniu i z migracją.
• Performance-first:
• Dla ciężkich bibliotek (np. recharts, xlsx) używaj dynamic import i ładuj je tylko na kliencie, gdy są potrzebne.
• A11y-first:
• Korzystaj z semantycznego HTML, poprawnych ról ARIA, focus management (szczególnie przy użyciu Radix UI).

5. Kontrakt wyjściowy AI (AI Output Contract – XML)
Każda propozycja zmiany pliku MUSI być zwrócona w formacie XML poniżej. Każdy zmieniany plik to oddzielny węzeł <change>. Zawartość pliku musi być kompletna (pełny plik), umieszczona w CDATA.

<changes>

<description>[Krótki opis wprowadzanych zmian]</description>
  <change>

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
• Nie dodawaj komentarzy poza strukturą XML, które mogłyby zaburzyć parser.

6. TypeScript, Lint, Format i Build (wymogi jakości)
• TypeScript:
• Preferuj: "strict": true, noImplicitAny, noUncheckedIndexedAccess, exactOptionalPropertyTypes.
• Dodaj typy dla środowiska (np. env.d.ts) i dla server-only modułów, jeśli użyte.
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

7. SSR/CSR/Server Actions i bezpieczeństwo sekretów
• Sekrety i biblioteki serwerowe (google-auth-library, google-spreadsheet) – tylko w środowisku serwerowym (API routes, Server Actions, route handlers).
• Nigdy nie używaj NEXT_PUBLIC_* dla sekretów.
• Waliduj dane wejściowe po stronie serwera (zod) i zwracaj kontrolowane błędy (status, message).
• Rozważ retry/backoff dla 429/5xx. Loguj błędy z kontekstem (bez wrażliwych danych).

7.A Redirecty w Next.js (diagnostyka i guardy w dev)
• NEXT_REDIRECT w dev to kontrolowany mechanizm Next – nie zawsze błąd.
• Diagnostyka: DevTools/Network (307/308, Location), middleware.ts, app//page.tsx/layout.tsx (redirect), app/api//route.ts (NextResponse.redirect), Server Actions.
• Guardy w dev:
• matcher: ['/((?!_next|static|favicon.ico|robots.txt|sitemap.xml).*)'] w middleware.
• Rozważ wyłączenie redirectów w dev (NODE_ENV === 'development') lub zawężenie warunków, aby uniknąć pętli.
• Zasady:
• Redirecty serwerowe tylko gdy konieczne (autoryzacja, canonical).
• W komponentach klienckich używaj router.push/replace zamiast redirect().

8. Integracja z Google Sheets (bezpieczeństwo i niezawodność)
• Uwierzytelnianie:
• Preferuj Service Account. Poświadczenia w zmiennych środowiska (np. JSON base64 dekodowany na serwerze).
• Upewnij się, że Service Account ma dostęp do odpowiednich arkuszy.
• Izolacja:
• Moduł src/lib/sheets.ts nie może być importowany w komponentach klienckich.
• Obsługa błędów:
• Zawijaj wywołania w try/catch, rozróżniaj błędy 4xx/5xx, stosuj ostrożny retry/backoff.
• Zwracaj czytelne komunikaty dla UI; loguj szczegóły po stronie serwera.
• Walidacja:
• Wszelki input waliduj schematami zod. Odrzucaj nieprawidłowe dane, nie ufaj klientowi.

9. UI/UX, A11y i Tailwind
• A11y:
• Semantyczne HTML5 (header, main, nav, footer).
• ARIA tylko tam, gdzie konieczne; aria-live dla komunikatów (toast/status).
• Radix UI: dbaj o role, aria-* i focus management. Używaj dostępnych wzorców.
• Tailwind:
• Mobile-first, sensowne breakpoints, unikanie FOUC/CLS.
• Upewnij się, że tailwind.config content zawiera wszystkie źródła (app//*, src//, components/**/).
• Stosuj utility-first, ale utrzymuj SRP i czytelność komponentów.
• Animacje:
• Używaj transform/opacity (GPU-friendly). Animacje subtelne, wspierające UX (micro-interactions).
• Formularze:
• react-hook-form + zodResolver na kliencie; walidacja powtórzona na serwerze.

10. Wydajność i budżet performance
• Code splitting i dynamic import dla ciężkich bibliotek (recharts, xlsx) oraz rzadko odwiedzanych widoków.
• Lazy-load obrazów i komponentów poza viewportem.
• Unikaj niepotrzebnych re-renderów (memo, useCallback/useMemo tam, gdzie ma to sens).
• Kontroluj wagę bundla. Eliminuj nieużywane zależności i importy.
• Preload/preconnect krytycznych zasobów, gdy uzasadnione.

11. Testowanie i obserwowalność
• Testy:
• Co najmniej smoke tests dla krytycznych komponentów i kluczowych flow (np. upload pliku, główne formularze).
• Walidacja schematów zod – testuj przykładowe payloady (dobry/zły).
• Obserwowalność:
• Logowanie po stronie serwera z kontekstem (request id, user id – jeśli istnieje).
• Spójny format błędów API (code, message, details?).
• Uważaj, by nie logować sekretów.

11.A React Hook Form – defaultValues i puste kolekcje
• Zasada: Każde pole tablicowe w RHF musi mieć defaultValues ustawione na [].
• Przykład: useForm({ defaultValues: { coordinators: [], addresses: [], localities: [] } })
• useFieldArray: używaj (fieldArray?.fields ?? []) w komponentach.
• watch: const localities = watch('localities') || []; Nigdy nie wywołuj watched.map bez guardu.
• Cel: brak „Cannot read properties of undefined (reading 'map')” przy pierwszym renderze i w dev.

12. Checklisty

Przed wysłaniem PR
• [ ] Zmiany ograniczone do wymaganych plików.
• [ ] Kod przechodzi npm run lint, npm run typecheck, npm run build.
• [ ] Brak importów serwerowych w kliencie.
• [ ] Zgodność ze standardami importów (aliasy > relatywne).
• [ ] Walidacja danych (zod) dla endpointów/API.
• [ ] UI/A11y sprawdzone (klawiatura, aria, kontrasty).
• [ ] Dynamic import dla ciężkich modułów, jeśli dotyczy.
• [ ] Safe Collections: wszystkie .map/.filter/.reduce działają na gwarantowanych tablicach (12.A/15.A).
• [ ] RHF: defaultValues ustawione, watch/useFieldArray zabezpieczone (11.A).

Przed wdrożeniem
• [ ] Zmienne środowiskowe ustawione (bez sekretów w NEXT_PUBLIC_*).
• [ ] Dostępy Service Account do Google Sheets zweryfikowane.
• [ ] Monitoring/logi działają, błędy raportują się poprawnie.
• [ ] Brak ostrzeżeń krytycznych w buildzie.
• [ ] Wydajność i rozmiar bundla akceptowalne.

12.A Checklista Safe Collections (.map/.filter/.reduce)
• [ ] Każda kolekcja używana z .map/.filter/.reduce jest tablicą (Array.isArray(...) === true) lub znormalizowana: arr = arr ?? [].
• [ ] Props „fields/items/list” mają domyślną wartość [] w definicji komponentu.
• [ ] Dane z RHF (watch, fieldArray.fields) zabezpieczone (|| [] / ?? []).
• [ ] Adaptery/mappery danych zwracają [] zamiast undefined/null.
• [ ] Test smoke: komponent renderuje się bez błędów dla pustych/nieobecnych danych wejściowych.

13. Minimalne skrypty (zalecane w package.json)
• "typecheck": "tsc --noEmit"
• "format": "prettier . --write"
• "format:check": "prettier . --check"
• "lint:ci": "eslint . --max-warnings=0"

14.1 Zasady ogólne
• Centralizacja: Wszystkie operacje na datach wykonuj przez wspólne helpery w module: /src/lib/date.ts.
• Zakazane: Wywoływanie nieistniejących/niezaimportowanych funkcji typu formatDate w plikach eksportu Excela lub komponentach. Jeśli potrzebujesz formatowania – użyj funkcji z /src/lib/date.ts.
• Biblioteka: Używamy date-fns. Nie wywołuj funkcji, których nie ma w date-fns (np. formatDate – to nie jest funkcja date-fns). Zamiast tego używaj format z date-fns lub helperów z /src/lib/date.ts.
• Typy: Zawsze operuj na Date lub bezpiecznie parsuj string/number do Date przed formatowaniem.

14.2 Kontrakt helperów (musi istnieć plik /src/lib/date.ts)
W module /src/lib/date.ts muszą istnieć co najmniej:
• formatDate(input: Date | string | number, pattern?: string): string
• Domyślny pattern: "yyyy-MM-dd"
• Zasady: jeśli input jest stringiem – spróbuj parseISO, w pozostałych przypadkach new Date(input). W razie nieprawidłowej daty zwróć pusty string lub rzuć kontrolowany błąd (w zależności od przypadku użycia).
• formatDateTime(input: Date | string | number, pattern?: string): string
• Domyślny pattern: "yyyy-MM-dd HH:mm"
• parseMaybeDate(input: Date | string | number): Date | null
• Zwraca Date lub null, bez rzucania wyjątków.
• isValidDate(input: unknown): boolean
• true, jeśli to poprawny obiekt Date (i nie NaN).

Wszyscy konsumenci (UI, API, export do Excela) importują wyłącznie z "@/lib/date".

14.3 Zasady użycia w Excel Export (xlsx)
• Formatowanie przed zapisem:
• Daty do Excela zapisuj jako sformatowane stringi przez formatDate lub formatDateTime. Zalecane formaty UI: "dd.MM.yyyy" dla dat, "dd.MM.yyyy HH:mm" dla dat z czasem.
• Walidacja wejścia:
• Jeśli źródło dat jest stringowe (np. z Google Sheets/API), zawsze użyj parseMaybeDate i sprawdź isValidDate przed formatowaniem. W przypadku nieprawidłowej daty – wpisz pusty string lub oznacz w raporcie „Nieprawidłowa data”.
• Importy:
• Zabronione: lokalne definiowanie funkcji o nazwie formatDate w plikach eksportu. Zawsze importuj z "@/lib/date".
• Spójność kolumn:
• Kolumny dat w raporcie muszą korzystać z jednego spójnego formatu (np. "dd.MM.yyyy").

14.4 Reguły dla AI (dot. dat i Excela)
• Jeśli widzisz wywołanie formatDate, a nie ma importu z "@/lib/date", dodaj poprawny import i użyj helpera.
• Jeśli helper nie istnieje – najpierw utwórz /src/lib/date.ts zgodnie z kontraktem z pkt 14.2, a dopiero potem modyfikuj pliki eksportu.
• Nie zamieniaj formatDate na nieistniejące funkcje date-fns. date-fns używa funkcji format. Helpery wrapują format i parsowanie.
• Zanim zwrócisz zmiany, mentalnie zweryfikuj, że import "@/lib/date" jest poprawny (aliasy), a kod przejdzie lint/typecheck/build.

14.5 Checklist (daty/Excel)
• [ ] Plik /src/lib/date.ts istnieje i eksportuje: formatDate, formatDateTime, parseMaybeDate, isValidDate.
• [ ] Wszędzie, gdzie formatuję daty (UI, API, Excel), używam helperów z "@/lib/date".
• [ ] Stringowe daty zawsze parsuję (parseMaybeDate), a nieprzetwarzalne traktuję jako puste.
• [ ] W Excelu stosuję spójny format ("dd.MM.yyyy" lub "dd.MM.yyyy HH:mm").
• [ ] Brak lokalnych, ad-hoc funkcji formatDate w innych plikach.

Co jeszcze warto dodać do repo (opcjonalne, ale polecane)
• ESLint rule/grep w CI:
• Blokuj użycie „formatDate(” bez importu z "@/lib/date".
• Blokuj redefinicję „function formatDate(” poza /src/lib/date.ts.
• Testy jednostkowe dla /src/lib/date.ts:
• Poprawne formatowanie dat ISO/string/number.
• Zachowanie na niepoprawnych datach (null, "abc", NaN).
• Dokumentacja przykładów użycia w README (krótkie snippet’y, jak formatować daty i jak importować helpery).

5.1 Definicje i ogólne zasady
• Dozwolone stany puste: null, undefined, pusty string "" (po trim: "" traktujemy jako puste).
• Brak błędu: Puste pole nie generuje błędu walidacji, chyba że pole jest oznaczone jako wymagane (required).
• Normalizacja: Przed dalszym przetwarzaniem każde pole tekstowe trimujemy. Wartości puste normalizujemy do null lub "" zgodnie z kontekstem.
• Konsekwencja: Ten sam atrybut (np. nazwisko, data) musi mieć spójne zasady pustości w całej aplikacji (UI, API, Excel).

15.2 Walidacja (zod) – kontrakt
• Pola opcjonalne:
• Używaj z.string().optional().transform(v => (v?.trim() ? v.trim() : "")) gdy chcesz przechowywać "".
• Lub z.string().optional().transform(v => (v?.trim() ? v.trim() : null)) gdy chcesz przechowywać null.
• Pola wymagane:
• Używaj z.string().min(1, "Pole wymagane"), ale wcześniej zastosuj transform/trim.
• Daty opcjonalne:
• Używaj z.union([z.string(), z.date()]).optional().transform(v => {
if (!v) return null;
// string → spróbuj parseISO/new Date; jeśli niepoprawne, zwróć null
})
• Nigdy nie rzucaj błędu tylko dlatego, że pole jest puste, jeśli w schemacie jest oznaczone jako optional.

15.3 UI (formularze i widoki)
• Formularze:
• Dla pól opcjonalnych nie pokazuj błędu walidacji przy pustej wartości.
• Puste wartości wyświetlaj jako placeholder lub pusty input.
• Tabela/listy:
• Puste wartości renderuj jako "—", "Brak", lub pustą komórkę, zgodnie z design systemem.
• A11y:
• Dla elementów opisowych (np. aria-label) nie wstawiaj "undefined" lub "null". Używaj sensownych fallbacków, np. "Brak danych".

15.4 Excel Export (xlsx) – puste pola
• Tekst:
• Jeśli po normalizacji wartość jest pusta → zapisz "" (pusta komórka) lub "—" (jeśli wymagany jest wizualny placeholder).
• Daty:
• Jeśli parseMaybeDate zwróci null → zapisz pusty string "" (nie formatuj).
• Liczby:
• Jeśli pole jest opcjonalne i brak wartości → zapisz "" (nie 0, chyba że domena wymaga 0 jako domyślne).
• Kolumny wymagane:
• Jeśli dana kolumna jest wymagana domenowo, a wartość jest pusta → nie przerywaj eksportu. Zapisz "" i dołącz do raportu ostrzeżenia (np. lista w logach/console lub metadane raportu), ale nie traktuj tego jako błąd krytyczny.

15.5 Backend/API
• W endpointach i Server Actions:
• Normalizuj puste wejścia: puste stringi → "", null/undefined → null (zgodnie z modelem).
• Waliduj schematem zod: opcjonalne pola nie generują błędów.
• Nie zwracaj 4xx tylko dlatego, że pole opcjonalne jest puste.
• Logowanie:
• Loguj tylko nieoczekiwane błędy (np. typ niezgodny z kontraktem, błąd parsowania w polu wymaganym). Puste pola nie są błędem.

15.6 Reguły dla AI (Empty Handling)
• Jeśli widzisz błąd generowany przez puste pole, a pole nie jest wymagane – usuń błąd i zastosuj normalizację + cichy fallback ("" lub null).
• Przy formacie dat: jeśli wartość pusta lub nieparsowalna → zwróć "" bez błędu toast. W UI możesz pokazać subtelny badge „Brak”.
• W eksporcie Excela nigdy nie przerywaj procesu z powodu pustych pól. Zastosuj fallbacky i kontynuuj.
• Przed odpowiedzią zweryfikuj, że schematy zod pozwalają na pustość dla pól oznaczonych jako optional.

15.7 Checklist (Empty/Nullable)
• [ ] Schematy zod rozróżniają required vs optional i nie zwracają błędów dla pustych optional.
• [ ] UI nie pokazuje błędów toasts dla pustych optional – używa placeholderów.
• [ ] Excel Export zapisuje "" dla pustych optional (teksty/liczby/daty).
• [ ] parseMaybeDate zwraca null dla pustych/nieparsowalnych wartości; formatDate zwraca "" dla null.
• [ ] Brak przerywania flow (import/eksport/submit) z powodu pustych optional.

15.A Safe Collections – zasady dla .map/.filter/.reduce
• Zasada 1 (normalizacja): Zanim użyjesz .map/.filter/.reduce, upewnij się, że operand jest tablicą:
• const list = Array.isArray(input) ? input : [];
• Props z listami mają domyślną wartość [] (destrukturyzacja z default).
• Zasada 2 (adaptery): Adaptery danych (API/Sheets) zwracają [] zamiast undefined/null dla kolekcji.
• Zasada 3 (RHF): watch(...) i fieldArray.fields zawsze z guardem (|| [] / ?? []) – patrz 11.A.
• Zasada 4 (antywzorce – zakazane):
• Bezpośrednie input.map(...) jeśli input może być undefined/null.
• Łańcuchy ?.map bez fallbacku do [] tam, gdzie input może być nieobecny.
• Zasada 5 (UX): Puste kolekcje renderują stan pusty; nigdy nie powodują wyjątku.

16. Konwencje Git, PR, Commit i Release
• Branch naming: feature/<ticket-id>-krótki-opis, fix/<ticket-id>-..., chore/<opis>, docs/<opis>, refactor/<opis>, perf/<opis>, build/<opis>, ci/<opis>.
• Commit style: Conventional Commits (feat, fix, chore, refactor, docs, test, perf, build, ci, revert). Dodawaj kontekst (ticket/link) w body.
• PR:
• Wymagane min. 1–2 review (CODEOWNERS jeśli dotyczy), zielony CI jako warunek merge.
• Squash merge domyślny; unikaj merge commitów.
• Zakaz WIP na main. Draft PR do wczesnej dyskusji.
• Release:
• SemVer. Generuj changelog (changesets/conventional-changelog).
• Taguj releasy (vX.Y.Z). Release PR musi przejść pełny CI.

17. CODEOWNERS i odpowiedzialności przeglądu
• Utrzymuj plik CODEOWNERS:
• /src/lib/** – właściciele back-end/server-only
• /src/components/** – właściciele UI
• /src/lib/sheets.ts – integracje zewnętrzne
• /src/lib/date.ts – kontrakt dat
• /app/** lub /pages/** – routing
• PR wymagające zmian w tych obszarach muszą mieć review właścicieli.

18. Pre-commit i CI (husky, lint-staged, GitHub Actions)
• pre-commit: prettier + eslint + szybki typecheck na staged (lint-staged).
• pre-push: test + lint + typecheck.
• CI (GitHub Actions):
• Joby: install + cache, lint, typecheck, build, test (unit), e2e (opcjonalnie), a11y (opcjonalnie), Lighthouse CI (opcjonalnie).
• Blokuj merge przy czerwonym CI. Maks. ostrzeżenia: 0 w lint.

19. Polityka .env, bezpieczeństwo i zarządzanie sekretami
• Nigdy nie umieszczaj sekretów w NEXT_PUBLIC_*.
• Używaj .env.local (lokalnie) i .env.example (szablon bez sekretów).
• Rotacja sekretów i minimalne uprawnienia (least privilege) dla Service Accounts.
• Redaction sekretów/PII w logach. Nie loguj access tokens, refresh tokens, kluczy.

20. Granice architektoniczne (client/server) i reguły ESLint
• Zakaz importów server-only w kodzie klienta („use client”).
• Wymuś to przez ESLint (import/no-restricted-paths, custom rules).
• Oddzielne katalogi na „server-only” i „client-only” oraz jasne entrypoints.

20.A ESLint/CI – wykrywanie niebezpiecznych .map i braków defaultValues
• ESLint:
• Włącz no-unsafe-optional-chaining i rozważ @typescript-eslint/strict-boolean-expressions (ostrożnie).
• import/no-restricted-paths dla granic client/server.
• Grep/CI (prosty, skuteczny):
• Wykrywaj wzorce:
 • „watch(”.map(” oraz „fieldArray.fields.map(” – wymagany guard „|| []”.

 • „?.map(” bez pobliskiego „?? []” lub wcześniejszej normalizacji (wymaga przeglądu PR).

• RHF:
• Reviewer sprawdza defaultValues dla wszystkich pól tablicowych.

21. API kontrakty, wersjonowanie i deprecje
• zod jako źródło prawdy dla request/response. Eksportuj TS typy przez z.infer.
• Spójny format błędów: { code, message, details? } + status HTTP.
• Wersjonuj API (v1, v2). Oznaczaj @deprecated w TS i dokumentacji. Zapewnij okres przejściowy.

22. Error handling i zasady UX komunikatów
• Błędy walidacji – inline, aria-live="polite". Błędy systemowe – toast/alert zrozumiały dla użytkownika.
• Nie wyświetlaj alertów dla pustych opcjonalnych pól.
• Global error boundary, fallback UI i raportowanie na serwerze (bez PII).

23. i18n/L10n (internacjonalizacja)
• Brak hardcoded tekstów w komponentach – używaj warstwy i18n.
• Fallbacki językowe, atrybut lang na html, daty/liczby formatowane wg locale jeśli wymagane przez domenę.

24. Budżety performance i narzędzia CI
• Budżety (orientacyjne, dostosuj do projektu):
• LCP < 2.5s, CLS < 0.1, TBT < 200ms, rozmiar JS per route < 200kB gz.
• Narzędzia:
• Lighthouse CI na PR (raport jako artefakt).
• next-bundle-analyzer – porównanie rozmiarów bundla między commitami.
• Anotacje w PR przy przekroczeniach (soft fail).

25. Accessibility – checklista i testy a11y
• Checklista:
• Focus visible, skip links, poprawna kolejność fokusa.
• Semantyczne role, label-associations, alt dla obrazów.
• Kontrast WCAG AA, aria-live dla statusów.
• Klawiatura: wszystkie interakcje dostępne bez myszy.
• Testy a11y:
• Automatyczne (axe) dla krytycznych widoków w CI (opcjonalnie).
• Manualne smoke w PR dla nowych komponentów.

26. Strategia testów (unit/component/integration/e2e)
• Unit: helpery (w tym /src/lib/date.ts), walidacje zod.
• Component: React Testing Library – zachowania i a11y.
• Integration: Server Actions/route handlers z mockami zewnętrznych usług.
• E2E: Playwright/Cypress dla krytycznych flow (logowanie, formularze, eksport).
• Snapshoty tylko dla stabilnych, mało zmiennych UI.

27. Logowanie, obserwowalność i PII/sekrety
• Poziomy logów: debug/info/warn/error. Korelacja request id.
• Redaction sekretów/PII. Sampling dla dużego ruchu.
• Raportowanie błędów po stronie serwera z kontekstem (bez sekretów).

28. Onboarding i DX
• Wymagania: wersja Node, menedżer pakietów (npm/yarn/pnpm).
• Kroki uruchomienia: instalacja, wypełnienie .env.local zgodnie z .env.example, komendy dev/lint/typecheck/build/test.
• Alias @ i struktura katalogów – krótkie przypomnienie.
• Jak uruchomić testy i e2e, jak odpalić bundle analyzer.

29. Szablony PR i commit (przykłady)
• PR:
• Tytuł: [feat|fix|chore|refactor|perf|docs] Krótki opis (ticket-id)
• Opis: Cel, Zakres, Zmiany, Jak testować, Checklisty, Ryzyka/Rollback.
• Commit:
• feat(ui): dodaj walidację formularza pracownika (ABC-123)
• fix(api): popraw błędny status w handlerze eksportu (ABC-456)
• chore(deps): aktualizacja date-fns do 3.x (bez zmian w API)

30. Architektura i budowa aplikacji webowej (guidelines senior) 30.1 Filary
• Czytelność > spryt; prostota > złożoność; jawne kontrakty > ukryte zależności; bezpieczeństwo i dostępność „by default”.
• Separacja odpowiedzialności (SoC), odwrócona zależność (DI), kompozycja ponad dziedziczenie, modularność.

30.2 Warstwy i granice
• Prezentacja (UI): komponenty czyste, bez efektów ubocznych, „client-only” wyłącznie jeśli potrzebne (interakcje, stan).
• Aplikacja (orchestration): routing, layouty, providers, zarządzanie stanem UI.
• Domenowa logika: use-cases w /src/lib/usecases/** (czyste funkcje/async), bez zależności od UI.
• Infrastruktura: integracje (np. /src/lib/sheets.ts), adaptery, dostęp do danych (server-only).
• Kontrakty: typy, zod schematy, DTO, mapery, adaptery – jako osobne moduły.
• Zasada: w górę importujemy tylko kontrakty/interfejsy; implementacje wstrzykujemy (DI przez parametry lub fabryki).

30.3 Przepływy danych (Next.js)
• SSR/SSG/RSC: preferuj server components dla fetch/ciężkich operacji; klient tylko dla interakcji.
• Server Actions: waliduj wejście (zod), zwracaj ustrukturyzowany wynik; loguj błędy.
• Route Handlers/API: czyste endpointy, bez logiki UI; 1 miejsce walidacji i mapowania.
• Client: minimalny global state; preferuj lokalny stan i serwer jako źródło prawdy.

30.4 Komponenty UI i stan pusty
• SRP, default props dla kolekcji: [].
• Nigdy nie używaj .map bez gwarancji tablicy; stosuj normalizację danych wejściowych.
• A11y i stany puste: komunikaty „Brak danych” zamiast błędów.

Uwagi końcowe
• Jeśli zadanie wymaga zmiany struktur danych lub API, opisz migrację i wpływ na istniejące ekrany/komponenty.
• Preferuj przejrzystość nad „sprytem”. Kod ma być łatwy w utrzymaniu przez zespół.
]]></content>
  </change>

</changes>
