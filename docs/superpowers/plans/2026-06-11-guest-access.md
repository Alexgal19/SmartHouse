# Guest Access (Wejście jako Gość) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać na ekranie logowania przycisk „Wejdź jako Gość", który po wpisaniu wspólnego hasła (sekret `GUEST_PASSWORD`) loguje użytkownika w trybie gościa z dostępem wyłącznie do modułu Odbiór.

**Architecture:** Rola gościa (`isGuest`) jest już zbudowana — nawigacja filtrowana do Odbioru, widok zablokowany, bramki API. Dokładamy tylko bramę wejścia: czysty walidator hasła w osobnym module (`src/lib/guest-auth.ts`, testowalny w izolacji), nową server action `loginAsGuest` w `auth.ts` (rate-limit + sesja gościa), oraz przycisk + dialog na ekranie logowania. Hasło trzymane jako sekret env, nigdy w kodzie.

**Tech Stack:** Next.js 14 App Router, TypeScript, iron-session, Firebase App Hosting secrets, Jest, shadcn/ui (Dialog), i18n (`useLanguage`/`t`).

**Spec:** `docs/superpowers/specs/2026-06-11-guest-access-design.md`

> **Uwaga o commitach:** kroki „Commit" są częścią procesu. Zgodnie z zasadą właściciela projektu — przed każdym `git commit`/`git push` poproś o wyraźną zgodę (nie commituj automatycznie). Push na `main` uruchamia deploy produkcyjny.

---

## Struktura plików

| Plik | Akcja | Odpowiedzialność |
|---|---|---|
| `src/lib/guest-auth.ts` | Create | Czysta funkcja `isValidGuestPassword(input, secret)` — fail-closed, bez zależności (testowalna w izolacji) |
| `src/lib/__tests__/guest-auth.test.ts` | Create | Testy jednostkowe walidatora |
| `src/lib/auth.ts` | Modify | Nowa server action `loginAsGuest(password_input)` — rate-limit + sesja gościa |
| `src/lib/translations/pl.ts` | Modify | Klucze i18n (PL) dla przycisku i dialogu |
| `src/lib/translations/en.ts` | Modify | Klucze i18n (EN) dla przycisku i dialogu |
| `src/app/login/page.tsx` | Modify | Przycisk „Wejdź jako Gość" + Dialog z polem hasła |
| `.env.local` | Modify | `GUEST_PASSWORD=Sh21\$` (escape `$`) |
| `apphosting.yaml` | Modify | Wpis sekretu `GUEST_PASSWORD` w `env:` |
| Firebase App Hosting | Config | `firebase apphosting:secrets:set GUEST_PASSWORD` |

---

## Task 1: Czysty walidator hasła gościa

**Files:**
- Create: `src/lib/guest-auth.ts`
- Test: `src/lib/__tests__/guest-auth.test.ts`

Powód osobnego modułu: `jest.setup.mjs` globalnie mockuje cały `@/lib/auth`, więc logika testowalna musi żyć poza nim.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/guest-auth.test.ts`:

```ts
import { isValidGuestPassword } from '../guest-auth';

describe('isValidGuestPassword', () => {
  it('zwraca true gdy hasło zgadza się z sekretem', () => {
    expect(isValidGuestPassword('Sh21$', 'Sh21$')).toBe(true);
  });

  it('zwraca false gdy hasło jest błędne', () => {
    expect(isValidGuestPassword('zle', 'Sh21$')).toBe(false);
  });

  it('fail-closed: zwraca false gdy sekret nie jest ustawiony', () => {
    expect(isValidGuestPassword('Sh21$', undefined)).toBe(false);
    expect(isValidGuestPassword('', undefined)).toBe(false);
  });

  it('fail-closed: zwraca false gdy sekret jest pustym stringiem', () => {
    expect(isValidGuestPassword('', '')).toBe(false);
  });

  it('zwraca false gdy podane hasło jest puste', () => {
    expect(isValidGuestPassword('', 'Sh21$')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- guest-auth`
Expected: FAIL — `Cannot find module '../guest-auth'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/guest-auth.ts`:

```ts
/**
 * Czysty walidator hasła gościa — bez zależności, testowalny w izolacji.
 * Fail-closed: jeśli sekret nie jest ustawiony, logowanie gościa jest niemożliwe.
 */
export function isValidGuestPassword(input: string, secret: string | undefined): boolean {
  if (!secret) return false;       // brak sekretu → fail-closed
  if (input.length === 0) return false;
  return input === secret;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- guest-auth`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit** (poproś o zgodę właściciela przed wykonaniem)

```bash
git add src/lib/guest-auth.ts src/lib/__tests__/guest-auth.test.ts
git commit -m "feat: czysty walidator hasła gościa (isValidGuestPassword)"
```

---

## Task 2: Server action `loginAsGuest`

**Files:**
- Modify: `src/lib/auth.ts` (dodać import + nową funkcję po `login()`, przed `logout()` ~linia 143)

Wykorzystuje istniejące, prywatne w module funkcje: `checkRateLimit`, `recordFailedAttempt`, `clearAttempts`, oraz wzorzec pobrania IP i sesji z `login()`.

- [ ] **Step 1: Dodać import walidatora**

W `src/lib/auth.ts`, po istniejących importach (po linii `import { adminDb } from '@/lib/firebase-admin';`) dodać:

```ts
import { isValidGuestPassword } from '@/lib/guest-auth';
```

- [ ] **Step 2: Dodać funkcję `loginAsGuest`**

W `src/lib/auth.ts`, bezpośrednio po zamknięciu funkcji `login()` (po jej `}`), a przed `export async function logout()`, wstawić:

```ts
export async function loginAsGuest(password_input: string): Promise<{
  success: boolean;
  user?: {
    uid: string; name: string;
    isAdmin: boolean; isDriver: boolean; isRekrutacja: boolean; isBok: boolean;
    isGuest: boolean; canEditPastControlCards: boolean;
  };
  error?: string;
}> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  await checkRateLimit(ip); // rzuca błąd przy przekroczeniu limitu — łapany w UI

  if (!isValidGuestPassword(password_input, process.env.GUEST_PASSWORD)) {
    if (!process.env.GUEST_PASSWORD) {
      console.warn('[auth] GUEST_PASSWORD nie jest ustawione — logowanie gościa wyłączone (fail-closed).');
    }
    await recordFailedAttempt(ip);
    return { success: false, error: 'Nieprawidłowe hasło gościa.' };
  }

  await clearAttempts(ip);
  const session = await getSession();
  session.isLoggedIn = true;
  session.uid = 'guest';
  session.name = 'Gość';
  session.isAdmin = false;
  session.isDriver = false;
  session.isRekrutacja = false;
  session.isBok = false;
  session.isGuest = true;
  session.canEditPastControlCards = false;
  await session.save();

  return {
    success: true,
    user: {
      uid: 'guest', name: 'Gość',
      isAdmin: false, isDriver: false, isRekrutacja: false, isBok: false,
      isGuest: true, canEditPastControlCards: false,
    },
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: brak błędów.

- [ ] **Step 4: Commit** (poproś o zgodę przed wykonaniem)

```bash
git add src/lib/auth.ts
git commit -m "feat: server action loginAsGuest (rate-limit + sesja gościa)"
```

---

## Task 3: Klucze i18n (PL + EN)

**Files:**
- Modify: `src/lib/translations/pl.ts`
- Modify: `src/lib/translations/en.ts`

Pliki to płaskie obiekty `{ 'klucz': 'wartość' }`. Dodajemy 5 nowych kluczy `login.*`.

- [ ] **Step 1: Dodać klucze do `pl.ts`**

W `src/lib/translations/pl.ts`, w obrębie obiektu `export const pl = { ... }` (np. po sekcji `// Navigation`, dowolne miejsce wewnątrz obiektu) dodać:

```ts
    // Guest login
    'login.guestButton': 'Wejdź jako Gość',
    'login.guestDialogTitle': 'Logowanie gościa',
    'login.guestPasswordLabel': 'Hasło gościa',
    'login.guestEnter': 'Wejdź',
    'login.guestError': 'Nieprawidłowe hasło gościa.',
```

- [ ] **Step 2: Dodać klucze do `en.ts`**

W `src/lib/translations/en.ts`, w obrębie obiektu `export const en = { ... }` dodać:

```ts
    // Guest login
    'login.guestButton': 'Enter as Guest',
    'login.guestDialogTitle': 'Guest login',
    'login.guestPasswordLabel': 'Guest password',
    'login.guestEnter': 'Enter',
    'login.guestError': 'Invalid guest password.',
```

- [ ] **Step 3: Type-check (wykrywa rozjazd kluczy PL/EN, jeśli typ jest współdzielony)**

Run: `npx tsc --noEmit`
Expected: brak błędów.

- [ ] **Step 4: Commit** (poproś o zgodę przed wykonaniem)

```bash
git add src/lib/translations/pl.ts src/lib/translations/en.ts
git commit -m "i18n: klucze logowania gościa (login.guest*)"
```

---

## Task 4: Login page — przycisk „Wejdź jako Gość" + Dialog

**Files:**
- Modify: `src/app/login/page.tsx`

Strona już importuje `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter`, `Input`, `Label`, `Button`, `useToast`, `useLanguage`. Trzeba dodać import `loginAsGuest`, stan, przycisk i dialog.

- [ ] **Step 1: Rozszerzyć import auth o `loginAsGuest`**

Zamienić w `src/app/login/page.tsx`:

```ts
import { login } from '@/lib/auth';
```

na:

```ts
import { login, loginAsGuest } from '@/lib/auth';
```

- [ ] **Step 2: Dodać stan dla trybu gościa**

W komponencie `LoginForm`, po linii `const [showIOSDialog, setShowIOSDialog] = useState(false);` dodać:

```ts
    const [guestOpen, setGuestOpen] = useState(false);
    const [guestPassword, setGuestPassword] = useState('');
    const [guestLoading, setGuestLoading] = useState(false);
```

- [ ] **Step 3: Dodać handler logowania gościa**

W komponencie `LoginForm`, po funkcji `handleLogin` dodać:

```ts
    const handleGuestLogin = async () => {
        setGuestLoading(true);
        try {
            const { success, user, error } = await loginAsGuest(guestPassword);
            if (success && user) {
                toast({ title: `Witaj, ${user.name}!`, duration: 2000 });
                router.push('/dashboard');
            } else {
                toast({
                    variant: 'destructive',
                    title: t('login.guestError'),
                    description: error,
                });
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Wystąpił błąd',
                description: err instanceof Error ? err.message : 'Spróbuj ponownie później.',
            });
        } finally {
            setGuestLoading(false);
        }
    };
```

- [ ] **Step 4: Dodać przycisk „Wejdź jako Gość" w `CardFooter`**

W `src/app/login/page.tsx`, w `CardFooter`, po przycisku „Zaloguj się" (po jego zamknięciu `</Button>`, przed blokiem `{showInstallButton && ...}`) dodać:

```tsx
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setGuestOpen(true)}
                        disabled={isLoading}
                    >
                        {t('login.guestButton')}
                    </Button>
```

- [ ] **Step 5: Dodać Dialog gościa**

W `src/app/login/page.tsx`, po zamknięciu `</form>` (a przed `<IOSInstallDialog ... />` lub przed końcowym `</>` fragmentu, w zależności od struktury) dodać:

```tsx
            <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('login.guestDialogTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2 text-left py-2">
                        <Label htmlFor="guest-password">{t('login.guestPasswordLabel')}</Label>
                        <Input
                            id="guest-password"
                            type="password"
                            value={guestPassword}
                            onChange={(e) => setGuestPassword(e.target.value)}
                            disabled={guestLoading}
                            onKeyDown={(e) => { if (e.key === 'Enter' && guestPassword !== '') handleGuestLogin(); }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            className="w-full"
                            onClick={handleGuestLogin}
                            disabled={guestLoading || guestPassword === ''}
                        >
                            {guestLoading ? <Loader2 className="animate-spin" /> : t('login.guestEnter')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: brak błędów (jeśli `IOSInstallDialog`/struktura JSX wymaga innego miejsca wstawienia, dostosuj zachowując parzystość tagów).

- [ ] **Step 7: Commit** (poproś o zgodę przed wykonaniem)

```bash
git add src/app/login/page.tsx
git commit -m "feat: przycisk i dialog logowania gościa na ekranie logowania"
```

---

## Task 5: Sekret `GUEST_PASSWORD` + weryfikacja tożsamości + build

**Files:**
- Modify: `.env.local`
- Modify: `apphosting.yaml`
- Config: Firebase App Hosting secret

- [ ] **Step 1: Dodać sekret lokalnie (`.env.local`)**

Dodać nową linię (UWAGA: `$` musi być z backslashem, inaczej shell/dotenv go zje):

```
GUEST_PASSWORD=Sh21\$
```

- [ ] **Step 2: Dodać sekret do `apphosting.yaml`**

W `apphosting.yaml`, w sekcji `env:`, dodać wpis (obok pozostałych sekretów, np. po `ADMIN_PASSWORD`):

```yaml
  - variable: GUEST_PASSWORD
    secret: GUEST_PASSWORD
```

- [ ] **Step 3: Ustawić sekret w Firebase App Hosting**

Run:

```bash
firebase apphosting:secrets:set GUEST_PASSWORD
```

Po zapytaniu podać wartość `Sh21$` (tu bez backslasha — backslash to tylko escape w plikach .env).
Potwierdzić nadanie dostępu backendowi App Hosting, gdy CLI o to zapyta.

- [ ] **Step 4: Weryfikacja tożsamości gościa na zgłoszeniu**

Sprawdzić, że POST `/api/odbior/zgloszenie` ustawia `rekruterId`/`rekruterName` z sesji (a nie z pola formularza) — tak, aby zgłoszenie gościa miało `rekruterId='guest'` i pojawiło się na liście gościa (filtr `rekruterId === session.uid`).

Run: `grep -n "rekruterId\|rekruterName\|session" src/app/api/odbior/zgloszenie/route.ts`
Jeśli `rekruterId` jest brany z `formData` zamiast z sesji dla gościa — dopisać nadpisanie z sesji dla `session.isGuest`. (Jeśli już z sesji — bez zmian.)

- [ ] **Step 5: Pełny build (reguła projektu)**

Run: `npm run build`
Expected: zielony build.

- [ ] **Step 6: Restart serwera dev (reguła 11)**

Run:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; rm -rf .next; nohup npm run dev > /tmp/smarthouse-dev.log 2>&1 &
```

- [ ] **Step 7: Weryfikacja ręczna (manual)**

W przeglądarce `http://localhost:3000`:
1. Na ekranie logowania kliknąć „Wejdź jako Gość".
2. Wpisać `Sh21$` → „Wejdź".
3. Oczekiwane: przekierowanie do `/dashboard`, w nawigacji widoczny tylko Odbiór, brak innych zakładek.
4. Otworzyć „Zgłoś odbiór", wysłać zgłoszenie — pojawia się na liście gościa.
5. Wpisać błędne hasło → komunikat „Nieprawidłowe hasło gościa.", brak wejścia.

- [ ] **Step 8: Commit** (poproś o zgodę przed wykonaniem; `.env.local` jest w `.gitignore` — NIE commituj go)

```bash
git add apphosting.yaml
git commit -m "chore: sekret GUEST_PASSWORD dla logowania gościa (App Hosting)"
```

---

## Task 6 (opcjonalny): E2E Playwright

**Files:**
- Create: `tests/guest-login.spec.ts`

- [ ] **Step 1: Test E2E logowania gościa**

```ts
import { test, expect } from '@playwright/test';

test('gość loguje się i widzi tylko Odbiór', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Wejdź jako Gość' }).click();
  await page.getByLabel('Hasło gościa').fill(process.env.GUEST_PASSWORD ?? 'Sh21$');
  await page.getByRole('button', { name: 'Wejdź', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  // Nawigacja: brak zakładki Pulpit / Ustawienia dla gościa
  await expect(page.getByRole('link', { name: 'Ustawienia' })).toHaveCount(0);
});
```

- [ ] **Step 2: Uruchomić**

Run: `npx playwright test guest-login`
Expected: PASS (wymaga ustawionego `GUEST_PASSWORD` w środowisku testowym / `.env.local`).

- [ ] **Step 3: Commit** (poproś o zgodę przed wykonaniem)

```bash
git add tests/guest-login.spec.ts
git commit -m "test(e2e): logowanie gościa pokazuje tylko moduł Odbiór"
```

---

## Self-review (autor planu)

**Pokrycie spec:**
- §3.1 przycisk+hasło → Task 4 (UI) + Task 2 (action). ✓
- §3.2 zakres widoku bez zmian → brak zadania (zamierzone — nic nie ruszamy). ✓
- §3.3 tożsamość `uid:'guest'`/`name:'Gość'` → Task 2 Step 2. ✓
- §3.4 sekret env → Task 5. ✓
- §4 kontrakt `loginAsGuest` → Task 2 (zgodny typ zwrotny). ✓
- §5 tożsamość na zgłoszeniu → Task 5 Step 4 (weryfikacja). ✓
- §6 rate-limit + fail-closed → Task 1 (fail-closed) + Task 2 (rate-limit). ✓
- §7 testy → Task 1 (unit, wymagany) + Task 6 (E2E, opcjonalny). ✓
- §9 kryteria akceptacji → Task 5 Step 7 (manual) + Task 1/6 (auto). ✓

**Placeholdery:** brak — każdy krok ma konkretny kod/komendę.

**Spójność typów:** `isValidGuestPassword(input, secret)` identyczna sygnatura w Task 1 i Task 2. Typ zwrotny `loginAsGuest` zgodny z użyciem w Task 4 (`{ success, user, error }`). Klucze i18n `login.guest*` identyczne w Task 3 i Task 4. ✓
