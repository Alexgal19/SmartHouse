# ADR-001 — Google Sheets jako primary data store

**Status:** accepted
**Data:** 2026-04-26
**Decydent:** Project owner

## Kontekst

SmartHouse jest aplikacją zarządzającą zakwaterowaniem mieszkańców — koordynatorzy nietechniczni potrzebują prostego dostępu do danych (eksport, ręczne korekty, audyty). Projekt jest utrzymywany przez właściciela bez zespołu DevOps/DBA.

## Decyzja

Główną bazą danych biznesowych jest **Google Sheets** dostępne przez API. Firestore używany jest tylko do:

- stanu autoryzacji (rate limiter)
- subskrypcji push (VAPID)
- listenerów real-time

## Konsekwencje

**Pozytywne:**

- Właściciel/koordynator może edytować dane bez kontaktu z deweloperem
- Brak kosztu utrzymania bazy SQL (RDS, Postgres)
- Naturalny eksport (każdy arkusz = CSV/XLSX)
- Audyt przez Google Drive history

**Negatywne:**

- Limity API (100 reads/100s/user) — wymagana warstwa cache
- Brak transakcji wielowierszowych — kompensacja przez SafeSheetOperation
- Ryzyko utraty danych przez nieostrożne operacje (mitigowane: zobacz [ADR-004](./0004-safe-sheet-operation-as-only-write-path.md), [ADR-005](./0005-eslint-no-restricted-syntax-blocks-sheets-delete.md))
- Zapytania ograniczone do filter-by-column (brak złożonych JOIN)

## Alternatywy rozważane

- **Firestore as primary** — odrzucone: trudna edycja przez nietechnicznego usera, brak natywnego eksportu
- **Postgres na Firebase Cloud SQL** — odrzucone: koszty, wymaga DBA, brak korzyści w skali projektu
- **Airtable** — odrzucone: dodatkowy koszt subskrypcji, gorsze API rate limity
