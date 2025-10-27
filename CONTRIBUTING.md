# Wytyczne dotyczące współtworzenia

Dziękujemy za zainteresowanie rozwojem tego projektu. Aby zapewnić najwyższą jakość kodu i stabilność aplikacji, prosimy o przestrzeganie poniższych zasad.

## 1. IZOLACJA I TESTOWANIE:
*   Zawsze zakładaj, że zmieniasz krytyczną część kodu. Przed wprowadzeniem jakiejkolwiek modyfikacji (nawet jeśli jest drobna), wewnętrznie zweryfikuj, że wszystkie istniejące testy jednostkowe i integracyjne, na które wpływa zmiana, przejdą pomyślnie.

## 2. ZAKRES ZMIAN:
*   Modyfikuj tylko te pliki, które są absolutnie niezbędne do wykonania zadania.
*   Nie zmieniaj żadnych innych komponentów, konfiguracji ani zależności, chyba że jest to bezpośrednio i logicznie wymagane przez zleconą funkcję.

## 3. BEZPIECZEŃSTWO KONTROLI WERSJI I WERYFIKACJA TYPÓW:
*   **KONTROLA WERSJI:** Zawsze wprowadzaj zmiany w sposób, który umożliwi łatwe cofnięcie. Wyświetl całe Git Diff dla wprowadzonych zmian, aby ułatwić mi inspekcję i ewentualne cofnięcie.
*   **WERYFIKACJA TYPÓW (TypeScript Safety):** Po każdej modyfikacji kodu bezwzględnie i wewnętrznie zweryfikuj, czy nie zostały wprowadzone żadne błędy kompilacji TypeScript. Kod musi przejść bezbłędnie komendę `npm run build` lub `npm run typecheck` (jeśli taka istnieje w projekcie). Wszelkie nowe funkcje muszą używać jawnych i ścisłych typów (strict mode).

## 4. STRUKTURA PROJEKTU:
*   **Logika biznesowa** jest oddzielona od interfejsu użytkownika. Znajduje się głównie w `src/lib/actions.ts` (akcje serwerowe) oraz `src/lib/sheets.ts` (interakcja z Google Sheets).
*   **Komponenty interfejsu** są podzielone na ogólne (`src/components/ui`) i funkcyjne (`src/components`).
*   **Główny layout** aplikacji (`src/components/main-layout.tsx`) zarządza globalnym stanem i dostarcza dane do komponentów podrzędnych.

## 5. ZARZĄDZANIE STANEM:
*   Aplikacja używa `MainLayoutContext` do zarządzania globalnym stanem (dane użytkowników, ustawienia itp.).
*   Wszelkie operacje modyfikujące dane (dodawanie, edycja, usuwanie) powinny być realizowane przez funkcje dostarczane przez ten kontekst (np. `handleUpdateSettings`, `handleAddEmployee`).

## 6. KONWENCJE NAZEWNICTWA:
*   Nazwy komponentów pisz w formacie `PascalCase` (np. `EntityView`).
*   Nazwy funkcji i zmiennych pisz w formacie `camelCase` (np. `handleSaveEmployee`).

## 7. FORMUŁOWANIE PROŚB O ZMIANY:
*   Bądź jak najbardziej precyzyjny. Zamiast "popraw wygląd", spróbuj "zmień kolor tła przycisku 'Zapisz' na niebieski".
*   Jeśli to możliwe, podawaj nazwy plików, które mam zmodyfikować.
*   Jeżeli chcesz dodać nową funkcjonalność, opisz krótko, jak ma ona działać i gdzie powinna się znajdować.

## NAJNOWSZE SPECYFIKACJE DESIGNU I BUDOWY WEBOWEJ ✨
*   **WYDAJNOŚĆ (PERFORMANCE):** Optymalizuj kod pod kątem szybkości ładowania. Stosuj leniwego ładowania (lazy loading) dla komponentów i obrazów poza widocznym obszarem (above-the-fold), a także minimalizację i drzewo potrząsania (tree-shaking) w zależnościach.
*   **DOSTĘPNOŚĆ (ACCESSIBILITY – A11y):** Buduj interfejsy z myślą o dostępności. Zawsze używaj poprawnej semantyki HTML5 (np. tagi `<header>`, `<main>`, `<nav>`) i prawidłowych atrybutów ARIA tam, gdzie jest to wymagane.
*   **RESPONSYWNOŚĆ I STYLOWANIE:** Stosuj metodę Mobile-First w stylach CSS. Wykorzystuj nowoczesne mechanizmy layoutu, takie jak CSS Grid i Flexbox, a nie starsze metody pozycjonowania.
*   **CZYSZCZENIE KODU:** Utrzymuj komponenty jako czyste i jednozadaniowe (Single Responsibility Principle). Używaj nowoczesnego JavaScriptu (ESM/ES2022+), unikając przestarzałych wzorców.

## C. ARCHITEKTURA, UX I STYLISTYKA (Wymagania Seniora) 👨‍💻
*   **ARCHITEKTURA KOMPONENTÓW:** Wszelkie nowe funkcje muszą być budowane przy użyciu wzorców kompozycji i zasady odpowiedzialności pojedynczej (SRP). Komponenty muszą być łatwe do ponownego użycia i utrzymania.
*   **TECHNICZNA BUDOWA UI:** Budowa kluczowych elementów interaktywnych (okna dialogowe, formularze, modalne) musi być zgodna z wytycznymi WAI-ARIA (dla dostępności) oraz stosować natywne mechanizmy przeglądarki tam, gdzie to możliwe.
*   **WIZUALNA JAKOŚĆ (UI/Stylistyka):**
    *   **Stylizacja:** Używaj nowoczesnych metod zarządzania stylami (np. CSS Modules, CSS-in-JS, lub Tailwind CSS, jeśli jest w projekcie) dla izolacji stylów.
    *   **Animacje:** Animacje muszą być wydajne (hardware-accelerated), używając właściwości `transform` i `opacity`. Animacje interaktywne powinny być płynne i wspierać koncepcję Micro-Interactions, by poprawić UX.
    *   **Kolory/Design System:** Stylizacja powinna być spójna z istniejącym designem/paletą kolorów projektu.

## Potok Importu Danych Excel (Architektura Seniora)
Podzielimy zadanie na trzy warstwy, z których każda musi spełniać Twoje wymagania.

### Warstwa 1: Frontend (Interfejs Użytkownika i UX)
Ta warstwa odpowiada za płynność działania i interakcję z użytkownikiem.

| Krok | Wymagania Seniora/Zasady | Opis Implementacji |
|---|---|---|
| **Komponent Uploadu** | SRP (Single Responsibility Principle), Mobile-First | Stwórz dedykowany, czysty komponent (np. `ExcelUploadForm.tsx`). Używaj semantyki i atrybutów ARIA dla przycisku wyboru pliku (A11y). |
| **Walidacja Wstępna** | TypeScript Safety | Sprawdź typ pliku (np. `file.type` lub rozszerzenie) po stronie klienta. Zapewnij natychmiastową informację zwrotną, jeśli plik nie jest Excelem (poprawia UX). |
| **Obsługa > 1 MB** | Performance (CWV), UX | Po wybraniu pliku: zablokuj interfejs (np. za pomocą modalnego okna dialogowego - UX) i natychmiast wyślij plik do serwera. |
| **Śledzenie Postępu**| UX, Architektura Komponentów | Zamiast czekać na odpowiedź serwera, po wysłaniu pliku, klient powinien otrzymać `Job ID` (ID zadania w tle). Następnie użyj WebSockets lub Polling (co 5-10 sekund) do serwera, aby śledzić status przetwarzania. Pokaż płynny progress bar lub status oczekiwania (Animacje/Stylistyka). |

### Warstwa 2: Serwer/API (Brama wejściowa i Bezpieczeństwo)
Ta warstwa zajmuje się przyjęciem pliku i delegowaniem pracy.

| Krok | Wymagania Seniora/Zasady | Opis Implementacji |
|---|---|---|
| **Ustalenie Limitu** | Bezpieczeństwo/Limity | Potwierdź, że limit wielkości ciała żądania (np. w `next.config.js` dla Server Actions) jest podniesiony do bezpiecznej, akceptowalnej wartości (np. 10MB), aby w ogóle przyjąć plik. |
| **Zapis Pliku** | Performance, Architektura | Natychmiast zapisz otrzymany plik do usługi przechowywania obiektów (np. Firebase Storage / Google Cloud Storage). To chroni pamięć serwera API przed przepełnieniem. |
| **Uruchomienie Asynchroniczne** | Architektura Komponentów (SRP) | Zamiast przetwarzać dane w handlerze API, uruchom dedykowane, długotrwałe zadanie w tle (np. Firebase Cloud Function dedykowaną tylko do przetwarzania Excela). Zwróć klientowi `Job ID` i kod statusu `202 Accepted`. |
| **Bezpieczeństwo Danych** | Zabezpieczenia | Zawsze filtruj i czyść nazwę pliku, ścieżkę i inne metadane przed użyciem ich w systemie plików (ochrona przed atakami typu Path Traversal). |

### Warstwa 3: Przetwarzanie Danych (Senior Logic i TypeScript Safety)
Ta warstwa jest kluczowa dla jakości danych.

| Krok | Wymagania Seniora/Zasady | Opis Implementacji |
|---|---|---|
| **Strumieniowe Czytanie** | Performance (> 10 MB) | Użyj biblioteki, która obsługuje strumieniowe czytanie plików Excel (np. SheetJS/xlsx w trybie strumieniowym). Pozwala to na przetwarzanie dużych plików w małych kawałkach, oszczędzając pamięć serwera/funkcji w tle. |
| **Jawne Typowanie** | TypeScript Safety | Zdefiniuj ścisłe interfejsy TypeScript dla każdej przetwarzanej kolumny danych (np. `interface ImportedUser { name: string; age: number; startDate: Date; }`). |
| **Weryfikacja i Konwersja** | TypeScript Safety, Architektura | W trakcie strumieniowego czytania: Weryfikuj każdą komórkę pod kątem typu (np. czy pole numeryczne to faktycznie liczba). Wymuszaj konwersję (np. daty z formatu Excela na obiekt `Date`). Wszystkie błędy walidacji raportuj, zamiast rzucać błędem i przerywać całe zadanie. |
| **Zapis do Bazy** | Architektura/Wydajność | Wstaw dane do bazy danych w transakcjach lub paczkach (batching), aby zoptymalizować wydajność I/O i zapewnić spójność danych. |
| **Finalizacja** | UX | Po zakończeniu przetwarzania (sukces lub błędy), zaktualizuj status `Job ID` w systemie powiadomień (np. Firestore), co automatycznie poinformuje klienta o zakończeniu. |
