# ADR-002 — iron-session zamiast NextAuth

**Status:** accepted
**Data:** 2026-04-26
**Decydent:** Project owner

## Kontekst

Aplikacja potrzebuje sesji użytkownika z weryfikacją po stronie serwera w Server Actions i API Routes. Pojedynczy provider auth (Firebase Authentication przez ID token w cookie). Brak potrzeby OAuth od wielu dostawców.

## Decyzja

Sesja użytkownika trzymana jest w **iron-session** (encrypted cookie). Token Firebase ID weryfikowany przez **Firebase Admin SDK** (`verifyIdToken`) przy logowaniu i odnowieniu sesji.

Implementacja:

- `src/lib/session.ts` — konfiguracja iron-session (sessionOptions, SessionData)
- `src/lib/auth.ts` — `getSession()` + `verifyIdToken()` integracja
- Każdy endpoint `/api/**` weryfikuje sesję przez `getIronSession`

## Konsekwencje

**Pozytywne:**

- Pełna kontrola nad cookie (httpOnly, secure, sameSite)
- Mały footprint biblioteki (vs. NextAuth z całym providerem ekosystemu)
- Łatwy debug — sesja to jeden cookie, można podejrzeć
- Brak dependency na bazę zewnętrzną dla sesji (stateless cookie)

**Negatywne:**

- Brak gotowych adapterów do OAuth providers (musimy używać Firebase Auth jako jedyny)
- Manualna implementacja flow refresh tokenu
- Wymaga `IRON_SESSION_PASSWORD` jako sekret (zobacz protokół trzech miejsc)

## Alternatywy rozważane

- **NextAuth.js** — odrzucone: nadmiarowe (multi-provider), trudniejszy debug, więcej dependencies
- **Auth.js (NextAuth v5)** — odrzucone: wciąż w stadium rozwoju, breaking changes
- **Firebase Auth client-side only** — odrzucone: brak weryfikacji po stronie serwera dla Server Actions
- **Custom JWT** — odrzucone: trzeba samemu zarządzać rotacją kluczy, podpisem, expiry
