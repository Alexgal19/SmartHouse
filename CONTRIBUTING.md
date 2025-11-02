Ten dokument definiuje standardy pracy dla ludzi i AI (Gemini w Firebase Studio) w tym repozytorium. Celem jest maksymalna stabilność, bezpieczeństwo, dostępność i jakość UI/UX przy minimalnym zakresie zmian.

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

Uwagi końcowe
• Jeśli zadanie wymaga zmiany struktur danych lub API, opisz migrację i wpływ na istniejące ekrany/komponenty.
• Preferuj przejrzystość nad „sprytem”. Kod ma być łatwy w utrzymaniu przez zespół.

]]></content>
  </change>

</changes>

