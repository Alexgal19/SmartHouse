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
