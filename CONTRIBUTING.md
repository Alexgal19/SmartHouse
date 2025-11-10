# Contributing to SmartHouse

This document provides guidelines for both human contributors and AI agents working on SmartHouse. For technical context and architecture details, also see `.github/copilot-instructions.md`.

> **Note:** This document defines working standards for stability, security, accessibility, and code quality with minimal scope changes.

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
14. Standard pracy z datami (Date Handling) i Excel Export
15. Zasady obsługi pustych pól (Empty/Nullable Handling)
16. Konwencje Git, PR, Commit i Release
17. CODEOWNERS i odpowiedzialności przeglądu
18. Pre-commit i CI (husky, lint-staged, GitHub Actions)
19. Polityka .env, bezpieczeństwo i zarządzanie sekretami
20. Granice architektoniczne (client/server) i reguły ESLint
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
    <content><![CDATA[[TUTAJ PEŁNA, FINALNA ZAWARTOŚĆ PLIKU – bez skrótów, bez diffów]