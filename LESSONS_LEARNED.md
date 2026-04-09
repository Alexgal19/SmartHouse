# LESSONS_LEARNED.md — Dziennik błędów i wzorców

> Plik prowadzony przez agentów zgodnie z protokołem z `AGENTS.md`.
> **Nie usuwaj wpisów.** Dopisuj UPDATE: jeśli coś się zmieniło.
> Czytaj przed każdą sesją.

---

## Indeks kategorii

- [FRONTEND] — React, komponenty, stan, UI
- [DATA] — Google Sheets, serializacja, cache
- [TYPES] — TypeScript, typy, interfejsy
- [ESLINT] — Reguły lintowania, ochrona danych
- [INFRA] — Pliki projektu, struktura, importy

---

### [FRONTEND] Input lag i cofanie się liter w polu wyszukiwania

**Symptom:** Użytkownik szybko wpisuje tekst w polu Szukaj — niektóre litery nie wpisują się lub wpisują się i cofają po ~300ms.

**Root cause:** Dwa `useEffect` walczyły ze sobą:

- Efekt 1: `localSearch` → debounce → URL update → `search` prop zmienia się
- Efekt 2: `useEffect(() => setLocalSearch(search), [search])` nadpisywał lokalny stan wartością z URL — dokładnie w momencie gdy użytkownik wciąż pisał

**Rozwiązanie:** Wprowadzono `committedRef` — ref przechowuje ostatnią wartość którą sami zapisaliśmy do URL. Sync `search → input` odpala się tylko gdy zmiana pochodzi z zewnątrz (np. czyszczenie filtrów), nie z własnego debounce.

```typescript
const committedRef = useRef(search);

useEffect(() => {
    if (search !== committedRef.current) {
        setLocalSearch(search);
        committedRef.current = search;
    }
}, [search]);

useEffect(() => {
    const timer = setTimeout(() => {
        if (localSearch !== search) {
            committedRef.current = localSearch;
            onSearch(localSearch);
        }
    }, 300);
    return () => clearTimeout(timer);
}, [localSearch, search, onSearch]);
```

**Obszar ryzyka:** Każdy komponent który synchronizuje stan lokalny ↔ URL params przez debounce. Wzorzec `useEffect(() => setLocal(prop), [prop])` + debounce = potencjalny konflikt.

**Pliki:** `src/components/entity-view.tsx`

---

### [FRONTEND] Filtr kolumny nie działa gdy etykieta opcji ≠ wartość pola

**Symptom:** Filtr "Adres" → "Własne mieszkanie" nie filtruje żadnych rekordów mimo że istnieją.

**Root cause:** Opcje dropdownu generowały etykietę `"Własne (ul. Kowalska 5)"` (z pola `ownAddress`) zamiast surowej wartości pola `address`. Logika filtrowania porównywała `entity.address = "Własne mieszkanie"` z wybraną opcją `"Własne (ul. Kowalska 5)"` — brak dopasowania.

**Rozwiązanie:** `addOptions('address', ...)` zwraca teraz surowe `rec.address` bez transformacji. Wartość opcji w dropdownie musi być identyczna z wartością porównywaną w logice filtrowania.

**Obszar ryzyka:** Każde miejsce gdzie opcje filtra są transformowane dla wyświetlania (np. `coordinatorId → coordinatorName`). Transformacja do wyświetlania jest OK tylko gdy logika filtrowania używa tej samej transformacji (`getCoordinatorName(entity.coordinatorId)`).

**Pliki:** `src/components/entity-view.tsx` (funkcja `addOptions`)

---

### [INFRA] Orphaned pliki w root lib/ i components/ powodują błędy TS

**Symptom:** `tsc --noEmit` zgłasza błędy w plikach których nikt nie importuje (`lib/sheets.ts`, `lib/actions.ts`, `components/entity-view.tsx`).

**Root cause:** Projekt ma dwa zestawy plików: root-level `lib/` i `components/` (stare) oraz `src/lib/` i `src/components/` (aktywne). Root-level pliki importowały z nieistniejącego `'../types'`. `tsconfig.json` włącza `**/*.ts` więc TypeScript je sprawdza mimo że żaden kod ich nie importuje.

**Rozwiązanie:** Usunięto orphaned pliki. Przed usunięciem — weryfikacja przez grep że żaden plik nie importuje danego modułu.

**Obszar ryzyka:** Nowe pliki tworzone poza `src/` mogą być orphaned. Zawsze sprawdzaj że nowy plik jest pod `src/` i że coś go importuje.

**Pliki:** `lib/actions.ts` ❌, `lib/sheets.ts` ❌, `components/entity-view.tsx` ❌, `components/main-layout.tsx` ❌ (usunięte)

---

### [TYPES] Podwójny export tego samego typu powoduje konflikt TS

**Symptom:** `error TS2484: Export declaration conflicts with exported declaration of 'ChartConfig'`

**Root cause:** `src/components/ui/chart.tsx` miało `export type ChartConfig = {...}` (linia 19) ORAZ `export type { ChartConfig }` (linia 416) — podwójny export tego samego identyfikatora.

**Rozwiązanie:** Usunięto redundantny `export type { ChartConfig }` na końcu pliku. Deklaracja `export type ChartConfig = {...}` wystarczy.

**Obszar ryzyka:** Pliki shadcn/ui generowane automatycznie mogą mieć takie wzorce. Sprawdzaj po każdym `npx shadcn add`.

**Pliki:** `src/components/ui/chart.tsx`

---

### [TYPES] Plik `.d.ts` z `declare module` nadpisuje typy biblioteki

**Symptom:** `error TS2315: Type 'TooltipProps' is not generic` mimo że recharts v2 ma `TooltipProps<TValue, TName>`.

**Root cause:** `src/types/recharts.d.ts` zawiera `declare module 'recharts'` który nadpisuje oryginalne typy biblioteki. Lokalny `interface TooltipProps` był zdefiniowany bez parametrów generycznych, przez co użycie `TooltipProps<any, any>` w `chart.tsx` powodowało błąd.

**Rozwiązanie:** Zmieniono `payload?: unknown[]` na `payload?: TooltipPayloadItem[]` (z własnym interfejsem), usunięto generic z użycia w chart.tsx.

**Obszar ryzyka:** Każdy `declare module '...'` w projekcie może cicho nadpisywać typy biblioteki. Sprawdzaj `src/types/` gdy pojawiają się dziwne błędy typów z zewnętrznych bibliotek.

**Pliki:** `src/types/recharts.d.ts`, `src/components/ui/chart.tsx`

---

### [ESLINT] ignorePatterns ukrywają naruszenia ochrony danych

**Symptom:** Plik `lib/actions.ts` miał wielokrotne wywołania `row.delete()`, `clearRows()`, `deleteRows()` — ESLint ich nie wykrywał bo plik był w `ignorePatterns`.

**Root cause:** `.eslintrc.json` `ignorePatterns` zawierało `"lib/actions.ts"` — reguła `no-restricted-syntax` chroniąca Google Sheets nie obejmowała tego pliku.

**Rozwiązanie:** Plik usunięto (był orphaned). Reguła `no-restricted-syntax` teraz obejmuje cały aktywny kod.

**Zasada:** `ignorePatterns` dla plików z logiką biznesową jest ZABRONIONE. Dozwolone tylko dla plików `.bak`, `.backup`, testów z deliberatnym kodem.

**Pliki:** `.eslintrc.json`, `lib/actions.ts` ❌ (usunięty)

---

### [INFRA] lib/safe-sheets.ts — import dynamiczny musi wskazywać src/lib/sheets

**Symptom:** `error TS2307: Cannot find module './sheets'` w `lib/safe-sheets.ts`.

**Root cause:** `lib/safe-sheets.ts` importował dynamicznie `'./sheets'` zakładając że `lib/sheets.ts` istnieje w tym samym katalogu. Po usunięciu orphaned `lib/sheets.ts` import przestał działać.

**Rozwiązanie:** Zmieniono na `'../src/lib/sheets'` — wskazuje na aktywny plik.

**Obszar ryzyka:** `lib/safe-sheets.ts` jest w root `lib/`, ale importuje z `src/lib/`. Jeśli `src/lib/sheets.ts` zmieni lokalizację — import się posypie.

**Pliki:** `lib/safe-sheets.ts`

---

### [DATA] Deserializacja dat i brakujących pól wymaga graceful degradation

**Symptom:** Aplikacja crasha lub zwraca `Invalid Date` gdy Google Sheets zwraca pustą komórkę w polu daty lub brakuje opcjonalnego pola w wierszu.

**Root cause:** Google Sheets API zwraca puste stringi (`""`) zamiast `null`/`undefined` dla pustych komórek. Kod który bezpośrednio wywołuje `new Date(value)` lub zakłada że pole istnieje może dostać `Invalid Date` lub `undefined` bez ostrzeżenia — bez wyrzucenia wyjątku, tylko ciche uszkodzenie danych.

**Rozwiązanie:** Warstwa deserializacji (parsowanie wierszy Sheets → obiekty TS) musi zawierać jawne sprawdzenia:

```typescript
// Daty
const parsedDate = value ? new Date(value) : null;
const safeDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

// Opcjonalne pola stringowe
const optionalField = row['fieldName'] || undefined;
```

**Obszar ryzyka:** Każda funkcja która mapuje `row.get('...')` → typ TypeScript. Szczególnie: pola dat, pola enum (mogą mieć starą wartość nieobsługiwaną przez aktualny typ), pola numeryczne (`parseFloat('')` = `NaN`).

**Pliki:** `src/lib/sheets.ts`, wszystkie funkcje `getRows()` → mapper

---

### [DATA] Ustawienia ładowane batchami z throttlingiem — nie wołaj API dla każdego ustawienia osobno

**Symptom:** Przekroczenie limitów Google Sheets API przy inicjalizacji aplikacji — każdy moduł który potrzebuje swoich ustawień robił osobne zapytanie.

**Root cause:** Google Sheets API ma limit zapytań na minutę. Gdy wiele komponentów/modułów inicjalizuje się równolegle i każdy woła API osobno, łatwo osiągnąć limit — szczególnie przy cold starcie lub refreshu strony.

**Rozwiązanie:** Ustawienia ładowane są jednym zbiorczym zapytaniem (batch) z throttlingiem — wszystkie wywołania w oknie czasowym są kolejkowane i rozwiązywane jedną odpowiedzią. Nie twórz nowych punktów dostępu do ustawień poza istniejącym mechanizmem batch.

**Obszar ryzyka:** Każdy nowy moduł który potrzebuje dostępu do konfiguracji z Sheets. Nie importuj bezpośrednio funkcji odczytu Sheets — używaj istniejącego mechanizmu ustawień.

**Pliki:** `src/lib/settings.ts` (lub odpowiednik batching logic)

---

### [TYPES] Reduce callback na obiekcie wymaga jawnego typowania generycznego

**Symptom:** `error TS7006: Parameter 'acc' implicitly has an 'any' type` w reduce callback budującym obiekt z tablicy.

**Root cause:** TypeScript nie potrafi wydedukować typu akumulatora w `array.reduce((acc, item) => ...)` gdy wartość początkowa to `{}` — wnioskuje `{}` zamiast właściwego typu.

**Rozwiązanie:** Dodaj explicit generic do `reduce`:

```typescript
// Źle — acc: any
const config = items.reduce((acc, item) => {
  acc[item.key] = item.value;
  return acc;
}, {});

// Dobrze — acc: Record<string, string>
const config = items.reduce<Record<string, string>>((acc, item) => {
  acc[item.key] = item.value;
  return acc;
}, {});
```

**Obszar ryzyka:** Każdy `reduce` który buduje obiekt z pustym `{}` jako wartością początkową. Szczególnie w plikach shadcn/ui (`chart.tsx`, `ChartContainer`).

**Pliki:** `src/components/ui/chart.tsx` (ChartContainer)
