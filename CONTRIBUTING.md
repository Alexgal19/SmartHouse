# Wytyczne dotyczące współtworzenia

Dziękujemy za zainteresowanie rozwojem tego projektu. Aby zapewnić najwyższą jakość kodu i stabilność aplikacji, prosimy o przestrzeganie poniższych zasad.

## 1. IZOLACJA I TESTOWANIE:
*   Zawsze zakładaj, że zmieniasz krytyczną część kodu. Przed wprowadzeniem jakiejkolwiek modyfikacji (nawet jeśli jest drobna), wewnętrznie zweryfikuj, że wszystkie istniejące testy jednostkowe i integracyjne, na które wpływa zmiana, przejdą pomyślnie.

## 2. ZAKRES ZMIAN:
*   Modyfikuj tylko te pliki, które są absolutnie niezbędne do wykonania zadania.
*   Nie zmieniaj żadnych innych komponentów, konfiguracji ani zależności, chyba że jest to bezpośrednio i logicznie wymagane przez zleconą funkcję.

## 3. BEZPIECZEŃSTWO KONTROLI WERSJI:
*   Zawsze wprowadzaj zmiany w sposób, który umożliwi łatwe cofnięcie. Wyświetl całe Git Diff dla wprowadzonych zmian, aby ułatwić mi inspekcję i ewentualne cofnięcie.

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