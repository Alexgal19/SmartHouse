# SmartHouse — Project Skills

Skills projektowe dla Claude Code i innych AI assistantów. Każdy skill jest egzekwowalnym protokołem, nie dokumentem.

## Mapa skilli na agentów

| Skill | Agent | Kiedy się auto-uruchomi |
|---|---|---|
| [preflight-check](./preflight-check/SKILL.md) | Orchestrator | Start nowego zadania > 1 plik |
| [sheets-safe-write](./sheets-safe-write/SKILL.md) | Backend + Database | Dotknięcie Google Sheets |
| [api-auth-guard](./api-auth-guard/SKILL.md) | Backend | Edycja `src/app/api/**/route.ts` |
| [build-gate](./build-gate/SKILL.md) | DevOps | Przed "gotowe" / commit / deploy |
| [regression-surface-map](./regression-surface-map/SKILL.md) | QA | Przed testami / PR / merge |

## Typowy flow zadania

```
1. preflight-check       → zbierz kontekst, zmapuj role
2. api-auth-guard        → (gdy nowy endpoint)
3. sheets-safe-write     → (gdy zmiana danych)
4. [implementacja kodu]
5. build-gate            → tsc + lint + build
6. regression-surface-map → wybierz testy
7. [commit / deploy]
```

## Rozszerzanie

Dodając nowy skill:
1. Utwórz `.claude/skills/<nazwa>/SKILL.md` z frontmatter (`name`, `description`)
2. `description` decyduje o auto-invocation — napisz konkretne triggery (PL + EN)
3. Dodaj wpis do tabeli wyżej
4. Zgłoś do orchestratora — może wymagać aktualizacji AGENTS.md
