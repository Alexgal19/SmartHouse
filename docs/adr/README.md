# Architecture Decision Records (ADR)

Krótkie zapisy decyzji architektonicznych o znaczeniu długoterminowym dla projektu SmartHouse.

## Format wpisu

Patrz [AGENTS.md → Architecture Decision Records](../../AGENTS.md#architecture-decision-records-adr).

## Indeks

| ID | Tytuł | Status | Data |
| -- | ----- | ------ | ---- |
| [ADR-001](./0001-google-sheets-as-primary-store.md) | Google Sheets jako primary store | accepted | 2026-04-26 |
| [ADR-002](./0002-iron-session-instead-of-nextauth.md) | iron-session zamiast NextAuth | accepted | 2026-04-26 |
| [ADR-003](./0003-vapid-web-push-instead-of-fcm.md) | VAPID Web Push zamiast FCM | accepted | 2026-04-26 |
| [ADR-004](./0004-safe-sheet-operation-as-only-write-path.md) | SafeSheetOperation jako jedyna ścieżka zapisu | accepted | 2026-04-26 |
| [ADR-005](./0005-eslint-no-restricted-syntax-blocks-sheets-delete.md) | ESLint blokuje delete na Sheets | accepted | 2026-04-26 |

## Reguły

- ADR są **stałe** — nie usuwaj wpisów. Decyzję która stała się nieaktualna oznacz `superseded by ADR-XXX`
- Numerowanie sekwencyjne, nigdy nie reusuj numerów
- Tworzy je **DOCS Agent** za zgodą orchestratora po decyzji właściciela projektu
