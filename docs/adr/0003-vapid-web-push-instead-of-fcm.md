# ADR-003 — Native Web Push (VAPID) zamiast Firebase Cloud Messaging (FCM)

**Status:** accepted
**Data:** 2026-04-26
**Decydent:** Project owner

## Kontekst

Aplikacja wysyła powiadomienia push do koordynatorów (alerty, kontrole, BOK). Pierwotnie użyto FCM (Firebase Cloud Messaging), co wprowadzało zależność od Firebase Messaging SDK i jego konfiguracji (service worker FCM, projekt sender ID, klucze).

## Decyzja

Aplikacja używa **natywnego Web Push z protokołem VAPID** — bez Firebase Cloud Messaging.

Implementacja:

- Subskrypcje przechowywane w Firestore (kolekcja push subscriptions)
- Klucze VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) w Firebase App Hosting secrets
- Service worker w `public/sw.js` rejestruje natywny PushManager (bez FCM SDK)
- Send-side: biblioteka `web-push` (Node) z poziomu API Routes / Server Actions
- Logika subskrypcji: `lib/push/` i `src/app/api/push/`

## Konsekwencje

**Pozytywne:**

- Mniej kontekstu do utrzymania (brak konfiguracji FCM, brak Firebase Messaging SDK na froncie)
- Działa identycznie na wszystkich nowoczesnych przeglądarkach (Chrome, Firefox, Edge, Safari 16.4+)
- Mniejszy bundle JavaScript (brak `firebase/messaging`)
- Niezależność od dostawcy push backend (można zmigrować z Firebase na inny hosting)

**Negatywne:**

- Brak wbudowanej deduplikacji wysyłki na poziomie FCM (musimy sami zarządzać retry)
- Trzeba samemu obsłużyć cleanup wygasłych subskrypcji (410/404 z push service)
- Brak gotowego dashboardu jak w Firebase Console

## Alternatywy rozważane

- **Firebase Cloud Messaging (poprzedni stan)** — odrzucone: zbędna zależność, gorsze cross-browser
- **OneSignal / Pusher** — odrzucone: trzeci dostawca, koszty, dodatkowy SDK
- **Server-Sent Events** — odrzucone: nie działa w background gdy zamknięta karta

## Uwaga dla agentów

**NIE reintroducuj FCM-based push** — ten kod był świadomie usunięty. Każda zmiana w warstwie push idzie przez `lib/push/` i `web-push` library.
