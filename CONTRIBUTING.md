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
4. Zasady dla AI (AI Operating Rules)
5. Kontrakt wyjściowy AI (AI Output Contract – XML)
6. TypeScript, Lint, Format i Build (wymogi jakości)
7. SSR/CSR/Server Actions i bezpieczeństwo sekretów
8. Integracja z Google Sheets (bezpieczeństwo i niezawodność)
9. UI/UX, A11y i Tailwind
10. Wydajność i budżet performance
11. Testowanie i obserwowalność
12. Checklisty przed PR i przed wdrożeniem
13. Minimalne skrypty (zalecane)
14. Standard pracy z datami (Date Handling) i Excel Export
Cel: Ujednolicić formatowanie i parsowanie dat w całym projekcie oraz uniknąć błędów typu „formatDate is not defined”.
15. Zasady obsługi pustych pól (Empty/Nullable Handling)
Cel: Puste komórki/pola (null, undefined, "", " ") w danych nie są błędem – są stanem dozwolonym i powinny być konsekwentnie obsługiwane w UI, API i podczas eksportu do Excela.

1. Zasady ogólne (stabilność i minimalny zakres zmian)
• Traktuj każdą zmianę jako krytyczną. Ogranicz zakres do absolutnego minimum wymaganego przez zadanie.
• Nie modyfikuj niepowiązanych komponentów, konfiguracji ani zależności bez wyraźnej potrzeby.
• Każda zmiana musi przejść: lint, typecheck, build oraz lokalne uruchomienie dev.
• Preferuj małe, czytelne PR-y z jasnym opisem i pełnym diffem.

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
   1. Absolutne aliasy (preferowane): np. import { Foo } from '@/utils/Foo'
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

12. Checklisty

Przed wysłaniem PR
• [ ] Zmiany ograniczone do wymaganych plików.
• [ ] Kod przechodzi npm run lint, npm run typecheck, npm run build.
• [ ] Brak importów serwerowych w kliencie.
• [ ] Zgodność ze standardami importów (aliasy > relatywne).
• [ ] Walidacja danych (zod) dla endpointów/API.
• [ ] UI/A11y sprawdzone (klawiatura, aria, kontrasty).
• [ ] Dynamic import dla ciężkich modułów, jeśli dotyczy.

Przed wdrożeniem
• [ ] Zmienne środowiskowe ustawione (bez sekretów w NEXT_PUBLIC_*).
• [ ] Dostępy Service Account do Google Sheets zweryfikowane.
• [ ] Monitoring/logi działają, błędy raportują się poprawnie.
• [ ] Brak ostrzeżeń krytycznych w buildzie.
• [ ] Wydajność i rozmiar bundla akceptowalne.

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
   • Nie używaj czerwonych toasts/alertów tylko z powodu braku wartości.
• A11y:
   • Dla elementów opisowych (np. aria-label) nie wstawiaj "undefined" lub "null". Używaj sensownych fallbacków, np. "Brak danych".

15.4 Excel Export (xlsx) – puste pola
• Tekst:
   • Jeśli po normalizacji wartość jest pusta → zapisz "" (pusta komórka) lub "—" (jeśli wymagany jest wizualny placeholder).
• Daty:
   • Jeśli parseMaybeDate zwróci null → zapisz pusty string "" (nie formatuj).
   • Nie rzucaj błędu; eksport ma być stabilny przy mieszanych/niekompletnych danych.
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

Uwagi końcowe
• Jeśli zadanie wymaga zmiany struktur danych lub API, opisz migrację i wpływ na istniejące ekrany/komponenty.
• Preferuj przejrzystość nad „sprytem”. Kod ma być łatwy w utrzymaniu przez zespół.

]]></content>
  </change>

</changes>
>>>>>>> d03ff35 (wkladka Ustawienia otwierasie zbyt dlugo ja chce 0.2 sec)
