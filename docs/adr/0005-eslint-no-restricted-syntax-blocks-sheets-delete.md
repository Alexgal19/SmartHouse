# ADR-005 — ESLint `no-restricted-syntax` blokuje delete na Google Sheets

**Status:** accepted
**Data:** 2026-04-26
**Decydent:** Project owner

## Kontekst

[ADR-004](./0004-safe-sheet-operation-as-only-write-path.md) wprowadza politykę: brak twardego kasowania danych z Google Sheets. Sama polityka bez egzekucji nie wystarczy — code review jest podatny na ludzki błąd, a presja czasu sprzyja kopiowaniu wzorców z innych projektów (gdzie `delete` jest normalne).

## Decyzja

ESLint reguła `no-restricted-syntax` **blokuje build** na próbie wywołania:

- `row.delete()`
- `sheet.deleteRows(...)`
- `sheet.clearRows(...)`
- (oraz inne wzorce kasowania zdefiniowane w `eslint.config.*`)

Konfiguracja:

- Reguła w `eslint.config.*` (root projektu)
- `npm run lint` wymagany w pre-commit + CI
- `npm run build` wykonuje też lint — naruszenie blokuje deploy

## Konsekwencje

**Pozytywne:**

- Niemożliwe wprowadzenie do produkcji kodu kasującego dane przez przypadek
- Egzekucja na poziomie pipeline — niezależna od jakości code review
- Sygnał dla agentów AI: jasna granica, której nie można przekroczyć bez świadomej decyzji

**Negatywne:**

- Wymaga `// eslint-disable-next-line no-restricted-syntax` w istniejących, autoryzowanych wyjątkach (np. starsze fragmenty `actions.ts`)
- Każdy taki disable jest pułapką — nowi agenci mogą go skopiować jako wzorzec

## Reguła dla agentów

> **NIGDY nie kopiuj `// eslint-disable-next-line no-restricted-syntax`** z istniejącego kodu bez **pisemnej zgody właściciela projektu** i komentarza wyjaśniającego dlaczego.
>
> Jeśli widzisz ten komentarz w kodzie i chcesz dodać kolejny — STOP. Eskaluj do orchestratora.

## Alternatywy rozważane

- **Tylko code review** — odrzucone: udowodniona ścieżka utraty danych w przeszłości
- **TypeScript types blocking delete methods** — odrzucone: biblioteka `google-spreadsheet` udostępnia te metody jako część publicznego API, monkey-patching typów byłby kruchy
- **Pre-commit hook tylko** — odrzucone: można obejść `--no-verify`; reguła ESLint biegnie też w CI
- **Runtime guard** — odrzucone: błąd dopiero w produkcji; lepiej catchować w buildzie
