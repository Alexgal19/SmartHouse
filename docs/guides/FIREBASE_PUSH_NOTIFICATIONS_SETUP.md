# Konfiguracja Powiadomień Push Firebase

## Problem

Błąd: `messaging/token-subscribe-failed` - Request is missing required authentication credential

## Przyczyna

Firebase Cloud Messaging (FCM) nie jest prawidłowo skonfigurowany w projekcie Firebase lub wymaga dodatkowych uprawnień w Google Cloud Console.

## Rozwiązanie

### 1. Włącz Firebase Cloud Messaging API w Google Cloud Console

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Wybierz projekt: `studio-6821761262-fdf39`
3. W menu bocznym wybierz **APIs & Services** → **Library**
4. Wyszukaj "Firebase Cloud Messaging API"
5. Kliknij na wynik i naciśnij **ENABLE**

### 2. Sprawdź Service Account Permissions

1. W Google Cloud Console przejdź do **IAM & Admin** → **Service Accounts**
2. Znajdź service account: `firebase-adminsdk-fbsvc@studio-6821761262-fdf39.iam.gserviceaccount.com`
3. Upewnij się, że ma następujące role:
   - Firebase Admin SDK Administrator Service Agent
   - Cloud Messaging Admin (lub Firebase Cloud Messaging Admin)

### 3. Weryfikacja Web Push Certificates w Firebase Console

1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Wybierz projekt `studio-6821761262-fdf39`
3. Przejdź do **Project Settings** (ikona koła zębatego) → **Cloud Messaging**
4. W sekcji **Web Push certificates** sprawdź czy klucz VAPID jest prawidłowo skonfigurowany
5. Jeśli nie ma klucza, kliknij **Generate key pair**
6. Skopiuj wygenerowany klucz i zaktualizuj `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` w `.env.local`

### 4. Sprawdź Firebase Configuration

Upewnij się, że w pliku [`src/lib/firebase.ts`](src/lib/firebase.ts) jest prawidłowa konfiguracja:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyDQzoMbd1jAjEqmEzkk0uSrNbJ793yXljk",
  authDomain: "studio-6821761262-fdf39.firebaseapp.com",
  projectId: "studio-6821761262-fdf39",
  messagingSenderId: "294831457703",
  appId: "1:294831457703:web:e1e149f283e4eb2418e282"
};
```

### 5. Zweryfikuj Service Worker

Sprawdź czy Service Worker jest prawidłowo zarejestrowany:

1. Otwórz DevTools w przeglądarce (F12)
2. Przejdź do zakładki **Application**
3. W menu bocznym wybierz **Service Workers**
4. Upewnij się, że `firebase-messaging-sw.js` jest aktywny

### 6. Testowanie

Po wykonaniu powyższych kroków:

1. Wyczyść cache przeglądarki
2. Odśwież stronę (Ctrl + F5)
3. Spróbuj ponownie włączyć powiadomienia push

## Alternatywne rozwiązanie

Jeśli problem nadal występuje, możesz tymczasowo wyłączyć funkcjonalność powiadomień push:

1. Ukryj przycisk "Włącz powiadomienia" w interfejsie użytkownika
2. Usuń komponent `<PushSubscriptionManager />` z layoutu

## Uwagi techniczne

- Klucz VAPID w `.env.local`: `BC5em6aukbZAUYL_2CMOax89xDo-1e_FR3-phD-3xDh3cnENF4vY_s4IZjMNqyiqhDPzbWxPAyEEPSPbEWVF2hQ`
- Service Account: `firebase-adminsdk-fbsvc@studio-6821761262-fdf39.iam.gserviceaccount.com`
- Project ID: `studio-6821761262-fdf39`

## Poprawiona obsługa błędów

Kod został zaktualizowany w [`src/hooks/use-push-subscription.ts`](src/hooks/use-push-subscription.ts) aby wyświetlać bardziej zrozumiałe komunikaty błędów dla użytkowników.
