# LESSONS_LEARNED.md — Dziennik błędów i wzorców

> Plik prowadzony przez agentów zgodnie z protokołem z `AGENTS.md`.
> **Nie usuwaj wpisów.** Dopisuj UPDATE: jeśli coś się zmieniło.
> Czytaj przed każdą sesją.

---

## Indeks kategorii

- `[]` — React, komponenty, stan, UI
- `[]` — Google Sheets, serializacja, cache
- `[]` — TypeScript, typy, interfejsy
- `[]` — Reguły lintowania, ochrona danych
- `[]` — Pliki projektu, struktura, importy
- `[]` — Autoryzacja, sesje, rate limiting
- `[]` — Nagłówki bezpieczeństwa, hardening
- `[]` — Mocki, testy jednostkowe, Playwright

---

### `[]` Input lag i cofanie się liter w polu wyszukiwania

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

### `[]` Filtr kolumny nie działa gdy etykieta opcji ≠ wartość pola

**Symptom:** Filtr "Adres" → "Własne mieszkanie" nie filtruje żadnych rekordów mimo że istnieją.

**Root cause:** Opcje dropdownu generowały etykietę `"Własne (ul. Kowalska 5)"` (z pola `ownAddress`) zamiast surowej wartości pola `address`. Logika filtrowania porównywała `entity.address = "Własne mieszkanie"` z wybraną opcją `"Własne (ul. Kowalska 5)"` — brak dopasowania.

**Rozwiązanie:** `addOptions('address', ...)` zwraca teraz surowe `rec.address` bez transformacji. Wartość opcji w dropdownie musi być identyczna z wartością porównywaną w logice filtrowania.

**Obszar ryzyka:** Każde miejsce gdzie opcje filtra są transformowane dla wyświetlania (np. `coordinatorId → coordinatorName`). Transformacja do wyświetlania jest OK tylko gdy logika filtrowania używa tej samej transformacji (`getCoordinatorName(entity.coordinatorId)`).

**Pliki:** `src/components/entity-view.tsx` (funkcja `addOptions`)

---

### `[]` Orphaned pliki w root lib/ i components/ powodują błędy TS

**Symptom:** `tsc --noEmit` zgłasza błędy w plikach których nikt nie importuje (`lib/sheets.ts`, `lib/actions.ts`, `components/entity-view.tsx`).

**Root cause:** Projekt ma dwa zestawy plików: root-level `lib/` i `components/` (stare) oraz `src/lib/` i `src/components/` (aktywne). Root-level pliki importowały z nieistniejącego `'../types'`. `tsconfig.json` włącza `**/*.ts` więc TypeScript je sprawdza mimo że żaden kod ich nie importuje.

**Rozwiązanie:** Usunięto orphaned pliki. Przed usunięciem — weryfikacja przez grep że żaden plik nie importuje danego modułu.

**Obszar ryzyka:** Nowe pliki tworzone poza `src/` mogą być orphaned. Zawsze sprawdzaj że nowy plik jest pod `src/` i że coś go importuje.

**Pliki:** `lib/actions.ts` ❌, `lib/sheets.ts` ❌, `components/entity-view.tsx` ❌, `components/main-layout.tsx` ❌ (usunięte)

---

### `[]` Podwójny export tego samego typu powoduje konflikt TS

**Symptom:** `error TS2484: Export declaration conflicts with exported declaration of 'ChartConfig'`

**Root cause:** `src/components/ui/chart.tsx` miało `export type ChartConfig = {...}` (linia 19) ORAZ `export type { ChartConfig }` (linia 416) — podwójny export tego samego identyfikatora.

**Rozwiązanie:** Usunięto redundantny `export type { ChartConfig }` na końcu pliku. Deklaracja `export type ChartConfig = {...}` wystarczy.

**Obszar ryzyka:** Pliki shadcn/ui generowane automatycznie mogą mieć takie wzorce. Sprawdzaj po każdym `npx shadcn add`.

**Pliki:** `src/components/ui/chart.tsx`

---

### `[]` Plik `.d.ts` z `declare module` nadpisuje typy biblioteki

**Symptom:** `error TS2315: Type 'TooltipProps' is not generic` mimo że recharts v2 ma `TooltipProps<TValue, TName>`.

**Root cause:** `src/types/recharts.d.ts` zawiera `declare module 'recharts'` który nadpisuje oryginalne typy biblioteki. Lokalny `interface TooltipProps` był zdefiniowany bez parametrów generycznych, przez co użycie `TooltipProps<any, any>` w `chart.tsx` powodowało błąd.

**Rozwiązanie:** Zmieniono `payload?: unknown[]` na `payload?: TooltipPayloadItem[]` (z własnym interfejsem), usunięto generic z użycia w chart.tsx.

**Obszar ryzyka:** Każdy `declare module '...'` w projekcie może cicho nadpisywać typy biblioteki. Sprawdzaj `src/types/` gdy pojawiają się dziwne błędy typów z zewnętrznych bibliotek.

**Pliki:** `src/types/recharts.d.ts`, `src/components/ui/chart.tsx`

---

### `[]` ignorePatterns ukrywają naruszenia ochrony danych

**Symptom:** Plik `lib/actions.ts` miał wielokrotne wywołania `row.delete()`, `clearRows()`, `deleteRows()` — ESLint ich nie wykrywał bo plik był w `ignorePatterns`.

**Root cause:** `.eslintrc.json` `ignorePatterns` zawierało `"lib/actions.ts"` — reguła `no-restricted-syntax` chroniąca Google Sheets nie obejmowała tego pliku.

**Rozwiązanie:** Plik usunięto (był orphaned). Reguła `no-restricted-syntax` teraz obejmuje cały aktywny kod.

**Zasada:** `ignorePatterns` dla plików z logiką biznesową jest ZABRONIONE. Dozwolone tylko dla plików `.bak`, `.backup`, testów z deliberatnym kodem.

**Pliki:** `.eslintrc.json`, `lib/actions.ts` ❌ (usunięty)

---

### `[]` lib/safe-sheets.ts — import dynamiczny musi wskazywać src/lib/sheets

**Symptom:** `error TS2307: Cannot find module './sheets'` w `lib/safe-sheets.ts`.

**Root cause:** `lib/safe-sheets.ts` importował dynamicznie `'./sheets'` zakładając że `lib/sheets.ts` istnieje w tym samym katalogu. Po usunięciu orphaned `lib/sheets.ts` import przestał działać.

**Rozwiązanie:** Zmieniono na `'../src/lib/sheets'` — wskazuje na aktywny plik.

**Obszar ryzyka:** `lib/safe-sheets.ts` jest w root `lib/`, ale importuje z `src/lib/`. Jeśli `src/lib/sheets.ts` zmieni lokalizację — import się posypie.

**Pliki:** `lib/safe-sheets.ts`

---

### `[]` Deserializacja dat i brakujących pól wymaga graceful degradation

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

### `[]` Ustawienia ładowane batchami z throttlingiem — nie wołaj API dla każdego ustawienia osobno

**Symptom:** Przekroczenie limitów Google Sheets API przy inicjalizacji aplikacji — każdy moduł który potrzebuje swoich ustawień robił osobne zapytanie.

**Root cause:** Google Sheets API ma limit zapytań na minutę. Gdy wiele komponentów/modułów inicjalizuje się równolegle i każdy woła API osobno, łatwo osiągnąć limit — szczególnie przy cold starcie lub refreshu strony.

**Rozwiązanie:** Ustawienia ładowane są jednym zbiorczym zapytaniem (batch) z throttlingiem — wszystkie wywołania w oknie czasowym są kolejkowane i rozwiązywane jedną odpowiedzią. Nie twórz nowych punktów dostępu do ustawień poza istniejącym mechanizmem batch.

**Obszar ryzyka:** Każdy nowy moduł który potrzebuje dostępu do konfiguracji z Sheets. Nie importuj bezpośrednio funkcji odczytu Sheets — używaj istniejącego mechanizmu ustawień.

**Pliki:** `src/lib/sheets.ts` (funkcje getSettings, getSettingsFromSheet z in-memory cache)

---

### `[]` Reduce callback na obiekcie wymaga jawnego typowania generycznego

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

---

### `[]` safe-sheets.ts — jedyna ścieżka zapisu do Google Sheets

**Symptom:** Deweloperzy przypadkowo używają `getSheet()` bezpośrednio do operacji zapisu, ryzykując wywołanie `row.delete()` lub `clearRows()` które trwale usuwają dane.

**Root cause:** `getSheet()` jest niskopoziomową funkcją która daje pełny dostęp do arkusza — w tym do destrukcyjnych operacji. Bez warstwy pośredniej każdy nowy kod miał potencjał do skasowania danych.

**Rozwiązanie:** `lib/safe-sheets.ts` eksportuje `getSafeSheet()` — wrapper który zwraca proxy blokujące `row.delete()`, `sheet.clearRows()` i `sheet.deleteRows()`. ESLint reguła `no-restricted-syntax` dodatkowo blokuje te wywołania na poziomie statycznym. Każda nowa funkcja zapisująca do Sheets MUSI przechodzić przez `getSafeSheet()`.

**Zasada:** `getSheet()` dozwolone tylko dla odczytu. Każdy zapis → `getSafeSheet()`. Wyjątki wymagają `// eslint-disable-next-line` z uzasadnieniem i zatwierdzeniem właściciela.

**Obszar ryzyka:** Nowe funkcje w `src/lib/sheets.ts` które potrzebują zapisu. Zawsze używaj `getSafeSheet()` zamiast `getSheet()` dla ścieżek zapisu.

**Pliki:** `lib/safe-sheets.ts`, `src/lib/sheets.ts`, `.eslintrc.json`

---

### `[]` Firestore rate limiter z graceful degradation

**Symptom:** Gdy Firestore jest niedostępny (np. problem z siecią, limit quota), logowanie do aplikacji jest całkowicie zablokowane — rate limiter rzuca wyjątkiem zamiast przepuszczać request.

**Root cause:** `checkRateLimit()` w `src/lib/auth.ts` używa Firestore do śledzenia prób logowania. Gdy Firestore rzuca błędem, funkcja nie miała fallbacku — wyjątek propagował się i blokował `login()`.

**Rozwiązanie:** Wszystkie trzy funkcje rate limitera (`checkRateLimit`, `recordFailedAttempt`, `clearAttempts`) zawijają operacje Firestore w try/catch. Gdy Firestore jest niedostępny:

- `checkRateLimit` — przepuszcza request (fail-open, bezpieczeństwo nie blokuje dostępu)
- `recordFailedAttempt` — loguje błąd, nie przerywa flow
- `clearAttempts` — loguje błąd, nie przerywa flow

**Obszar ryzyka:** Każda zewnętrzna zależność w ścieżce krytycznej (auth, zapis danych). Zawsze projektuj z fallbackiem — brak zależności nie może blokować podstawowej funkcjonalności.

**Pliki:** `src/lib/auth.ts`

---

### `[]` CSP/HSTS + session hardening

**Symptom:** Aplikacja nie miała nagłówków Content-Security-Policy ani Strict-Transport-Security, a sesja nie miała limitu czasu życia — podatność na XSS, MITM i session hijacking.

**Root cause:** Brak konfiguracji nagłówków bezpieczeństwa w Next.js. Sesja iron-session nie miała `maxAge`. Service Worker nie weryfikował originu żądań.

**Rozwiązanie:** Dodano przez `next.config.mjs`:

- **CSP**: `Content-Security-Policy` ogranicza źródła skryptów, styli, obrazów i connect-src
- **HSTS**: `Strict-Transport-Security` wymusza HTTPS
- **Sesja**: `iron-session` z `maxAge` (ograniczony czas życia sesji)
- **Service Worker**: weryfikacja originu żądań przed ich obsługą

**Obszar ryzyka:** CSP może blokować legalne zasoby przy dodawaniu nowych integracji (np. zewnętrzne API, CDN). Gdy dodajesz nowe źródło danych — sprawdź czy CSP wymaga aktualizacji.

**Pliki:** `next.config.mjs`, `src/lib/session.ts`, `public/firebase-messaging-sw.js`

---

### `[]` Globalne mocki dla auth i firebase-admin w Jest

**Symptom:** Testy jednostkowe importujące `@/lib/auth` lub `@/lib/firebase-admin` crashują — próbują inicjalizować prawdziwego Firebase Admin SDK w środowisku jsdom.

**Root cause:** `firebase-admin` wymaga credentiali i połączenia sieciowego których nie ma w środowisku testowym. `iron-session` wymaga ciasteczek Next.js niedostępnych w jsdom.

**Rozwiązanie:** Dwa mechanizmy mockowania:

1. **`src/__mocks__/iron-session.js`** — mock `getIronSession` zwraca kontrolowaną sesję testową
2. **`jest.setup.mjs`** — globalny mock `@/lib/auth` i `@/lib/firebase-admin` przez `jest.mock()`

```javascript
// jest.setup.mjs
jest.mock('@/lib/auth', () => ({
  getSession: jest.fn().mockResolvedValue({
    isLoggedIn: true,
    isAdmin: true,
    id: 'test-user-id',
    name: 'Test Admin',
    role: 'admin',
  }),
  login: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('@/lib/firebase-admin', () => ({
  adminDb: undefined,
  adminMessaging: jest.fn(),
}));
```

**Obszar ryzyka:** Każdy nowy test jednostkowy który importuje moduły zależne od Firebase lub iron-session. Sprawdzaj `jest.setup.mjs` przed dodawaniem nowych mocków — może już tam być.

**Pliki:** `jest.setup.mjs`, `jest.config.mjs`, `src/__mocks__/iron-session.js`

---

### `[]` Offline-first zdjęcia z optymistycznym UI

**Symptom:** Upload zdjęć (karty kontroli, liczniki) powodował migotanie UI — zdjęcie pojawiało się dopiero po zakończeniu uploadu na serwer, a przy błędzie sieci znikało bez śladu.

**Root cause:** Flow: użytkownik wybiera plik → upload na serwer → odpowiedź z URL → URL dodany do stanu → UI się aktualizuje. Przy wolnej sieci opóźnienie było widoczne. Przy braku sieci — zdjęcie przepadało.

**Rozwiązanie:** Wzorzec offline-first z fallbackiem:

1. Zdjęcie kompresowane do data URL lokalnie (canvas resize)
2. Data URL natychmiast dodawany do stanu → UI pokazuje zdjęcie od razu
3. Równolegle: upload na serwer (Google Drive)
4. Po zakończeniu uploadu: data URL zamieniany na URL z serwera
5. Przy błędzie sieci: data URL zostaje, zdjęcie nie znika

```typescript
// Wzorzec z control-cards-view.tsx
const compressImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  // canvas resize do MAX 2000px, quality 0.85 → data URL
});

const uploadFiles = async (files: FileList, key: string): Promise<string[]> => {
  // Najpierw data URL (natychmiastowe UI), potem upload z fallbackiem
};
```

**Obszar ryzyka:** Duże zdjęcia (>10MB) jako data URL mogą obciążyć pamięć przeglądarki. Zawsze kompresuj przed konwersją do data URL.

**Pliki:** `src/components/control-cards-view.tsx`, `src/lib/actions.ts` (`uploadControlCardPhotoAction`)

---

### `[]` Double-click na datę do ręcznej edycji tekstowej

**Symptom:** Użytkownik musi klikać w kalendarz żeby wybrać datę — nie może po prostu wpisać daty z klawiatury. Dla dat sprzed kilku miesięcy/lat wymaga to dziesiątek kliknięć.

**Root cause:** Pola daty używały wyłącznie DatePicker (kalendarz + Popover) — nie obsługiwały bezpośredniego wprowadzania tekstu.

**Rozwiązanie:** Wzorzec `DateInput` z podwójnym trybem:

- **Tryb kalendarza (domyślny)**: Pole readonly + Popover z kalendarzem
- **Tryb tekstowy (double-click)**: Pole edytowalne, użytkownik wpisuje datę jako tekst
- Przełączanie: `onDoubleClick` / `onPointerDown` (2 szybkie tapnięcia na mobilnym)
- Parsowanie: `parseDateText(text: string): Date | null` — elastyczny parser (DD.MM.YYYY, DD-MM-YYYY, itd.)

```typescript
const enterTextMode = () => { setIsTextMode(true); setTextValue(formatDate(date)); };
const commitText = () => { 
  const parsed = parseDateText(textValue);
  if (parsed) { setDate(parsed); setIsTextMode(false); }
};
const handlePointerDown = (e: React.PointerEvent) => {
  // Wykrywa double-click/tap przed handlerem Popoveru
};
```

**Obszar ryzyka:** Ten sam pattern jest używany w 4+ komponentach: `edit-employee-form.tsx`, `edit-non-employee-form.tsx`, `edit-bok-resident-form.tsx`, `wizard-utils.tsx`, `header.tsx`. Przy zmianie w jednym miejscu — sprawdź pozostałe.

**Pliki:** `src/components/edit-employee-form.tsx`, `src/components/edit-non-employee-form.tsx`, `src/components/edit-bok-resident-form.tsx`, `src/components/wizard-utils.tsx`, `src/components/header.tsx`
