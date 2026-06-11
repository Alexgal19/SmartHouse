# Spec: Wejście do aplikacji jako Gość

- **Data:** 2026-06-11
- **Status:** zatwierdzony projekt (oczekuje na review spec → plan implementacji)
- **Autor:** Claude (brainstorming z właścicielem)

## 1. Cel

Dodać możliwość wejścia do aplikacji w trybie **Gość** przez dedykowany przycisk na
ekranie logowania, zabezpieczony wspólnym hasłem. Gość ma dostęp wyłącznie do modułu
**Odbiór** (formularz „Zgłoś odbiór" + lista własnych zgłoszeń). Pozostałe zakładki
i widoki są dla gościa niewidoczne.

## 2. Stan obecny (co już istnieje — NIE ruszamy)

Rola gościa jest w większości zaimplementowana:

- `SessionData.isGuest?: boolean` — `src/types.ts:195`
- Sesja gościa ustawiana w `src/lib/auth.ts` (`session.isGuest`)
- **Nawigacja filtrowana** — gość widzi w menu tylko `odbior`:
  `src/components/layouts/main-layout.tsx:341-343`
- **Widok zablokowany** — każdy inny `view` wraca do `odbior`:
  `src/components/layouts/main-layout.tsx:175-179`
- **Bramki API** — gość widzi tylko własne zgłoszenia, nie zmienia statusów:
  `src/app/api/odbior/zgloszenie/[id]/route.ts`, `src/app/api/odbior/zgloszenia/route.ts`
- Widok `odbior` adaptuje UI dla gościa (ukryte usuwanie itp.):
  `src/components/views/odbior-view.tsx`, `src/components/dialogs/odbior-detail-dialog.tsx`

**Wniosek:** brakuje wyłącznie **bramy wejścia** (przycisk + hasło + akcja logowania gościa).

## 3. Decyzje (zatwierdzone)

1. **Wejście:** przycisk „Wejdź jako Gość" na ekranie logowania → po kliknięciu
   mały `Dialog` z polem hasła → po wpisaniu `Sh21$` wejście jako gość.
2. **Zakres widoku gościa:** bez zmian — formularz „Zgłoś odbiór" + lista własnych
   zgłoszeń (obecne zachowanie modułu Odbiór dla gościa).
3. **Tożsamość gościa:** jedno wspólne konto — `uid:'guest'`, `name:'Gość'`,
   wszystkie inne role `false`, `isGuest:true`.
4. **Przechowywanie hasła:** sekret w env `GUEST_PASSWORD` (NIE hardkod w kodzie),
   zgodnie z konwencją projektu.

## 4. Architektura

### Przepływ

```
[Ekran logowania]
  ├─ Imię + Hasło + "Zaloguj się"        (bez zmian — login())
  └─ "Wejdź jako Gość" (type=button)     (nowy)
         ↓ klik → Dialog z polem hasła
         ↓ "Sh21$"
     loginAsGuest('Sh21$')               (nowa server action)
         ↓ rate-limit per-IP (ten sam mechanizm co login)
         ↓ password === process.env.GUEST_PASSWORD ?
     sesja: { isLoggedIn:true, uid:'guest', name:'Gość',
              isAdmin/isDriver/isRekrutacja/isBok:false, isGuest:true,
              canEditPastControlCards:false }
         ↓ router.push('/dashboard')
     main-layout: isGuest → menu = tylko Odbiór, widok zablokowany na Odbiór
                  (istniejąca logika)
```

### Komponenty / pliki do zmiany

| Plik | Zmiana | Odpowiedzialność |
|---|---|---|
| `src/lib/auth.ts` | nowa `loginAsGuest(password: string)` | walidacja hasła gościa, rate-limit, ustawienie sesji gościa |
| `src/app/login/page.tsx` | przycisk „Wejdź jako Gość" + `Dialog` z polem hasła + handler `handleGuestLogin` | UI wejścia gościa |
| `src/lib/translations/pl.ts` | klucze i18n (PL) | teksty UI |
| `src/lib/translations/en.ts` | klucze i18n (EN) | teksty UI |
| `.env.local` | `GUEST_PASSWORD=Sh21\$` (escape `$`!) | sekret lokalnie |
| `apphosting.yaml` | referencja sekretu `GUEST_PASSWORD` | sekret na produkcji |
| Firebase secrets | `firebase apphosting:secrets:set GUEST_PASSWORD` | sekret w App Hosting |

### Kontrakt `loginAsGuest`

```ts
// src/lib/auth.ts
export async function loginAsGuest(password_input: string): Promise<{
  success: boolean;
  user?: { uid: string; name: string; isGuest: true; /* reszta ról false */ };
  error?: string;
}>
```

- Wejście: hasło wpisane przez użytkownika.
- Rate-limit: `checkRateLimit(ip)` / `recordFailedAttempt(ip)` / `clearAttempts(ip)` —
  te same funkcje co `login()`.
- Sukces: `password_input === process.env.GUEST_PASSWORD` → zapis sesji gościa →
  `clearAttempts` → zwrot `{ success:true, user }`.
- Błąd: `recordFailedAttempt` → `{ success:false, error }`.
- Brak `GUEST_PASSWORD` w env → traktuj jak błąd logowania (fail-closed), zaloguj warning.

### Klucze i18n (propozycja)

`login.guestButton` = „Wejdź jako Gość" / „Enter as Guest"
`login.guestDialogTitle` = „Logowanie gościa" / „Guest login"
`login.guestPasswordLabel` = „Hasło gościa" / „Guest password"
`login.guestEnter` = „Wejdź" / „Enter"
`login.guestError` = „Nieprawidłowe hasło gościa." / „Invalid guest password."

## 5. Tożsamość i dane

- Zgłoszenia tworzone przez gościa otrzymują `rekruterId='guest'`, `rekruterName='Gość'`
  (z sesji, po stronie serwera).
- Konsekwencja: ponieważ konto gościa jest wspólne, filtr „własnych zgłoszeń"
  (`rekruterId === session.uid`) pokazuje **wszystkim** gościom tę samą listę zgłoszeń
  gościa. To akceptowane i zamierzone przy jednym wspólnym koncie.
- **Punkt weryfikacji w implementacji:** potwierdzić, że POST `/api/odbior/zgloszenie`
  ustawia `rekruterId`/`rekruterName` z sesji (a nie z pola formularza) dla gościa.

## 6. Bezpieczeństwo

- Rate-limiting wejścia gościa (per-IP, Firestore) — ochrona `Sh21$` przed brute-force.
- Fail-closed gdy brak sekretu.
- Gość ograniczony server-side do modułu Odbiór i własnych zgłoszeń (istniejące bramki).
- `GUEST_PASSWORD` nigdy w repozytorium — tylko env/sekret.

## 7. Testy (reguła 3)

- **Unit (`src/lib/__tests__` lub odpowiednik):** `loginAsGuest` zwraca `success:true`
  dla poprawnego hasła i `success:false` dla błędnego; fail-closed przy braku sekretu.
- **E2E (opcjonalnie, Playwright):** klik „Wejdź jako Gość" → wpisanie hasła →
  widoczny tylko moduł Odbiór, brak innych zakładek w nawigacji.

## 8. Poza zakresem (YAGNI)

- Tworzenie/zarządzanie kontami gościa w Ustawieniach (nie potrzebne — jedno wspólne hasło).
- Wiele tożsamości gościa / osobne listy per gość.
- Zmiana zakresu widoku Odbiór dla gościa (zostaje jak jest).
- Link/kod zaproszenia (odrzucone na rzecz przycisku + hasła).

## 9. Kryteria akceptacji

1. Na ekranie logowania widoczny przycisk „Wejdź jako Gość".
2. Klik → dialog z polem hasła; poprawne hasło (`Sh21$`) loguje jako gość i przenosi do `/dashboard`.
3. Błędne hasło → komunikat błędu, brak wejścia; po wielu próbach rate-limit.
4. Zalogowany gość widzi w nawigacji wyłącznie Odbiór; inne widoki niedostępne.
5. Gość może wysłać zgłoszenie „Zgłoś odbiór" i widzi listę zgłoszeń gościa.
6. `GUEST_PASSWORD` jako sekret (env + apphosting.yaml + Firebase), nie w kodzie.
7. `npm run build` zielony; testy jednostkowe `loginAsGuest` przechodzą.
