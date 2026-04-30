# External Resources — Skills i wzorce dla SmartHouse

> Kuratorska lista skills, cookbooks i repozytoriów dobranych pod stack SmartHouse:
> Next.js 14 (App Router), TypeScript, Tailwind + shadcn/ui, Google Sheets primary store,
> iron-session + Firebase Admin auth, Web Push (VAPID), Firebase App Hosting.
>
> **Data ostatniej aktualizacji:** 2026-04-26
> **Maintainer:** DOCS Agent

---

## Jak korzystać z tej listy

Każda pozycja ma:

- **Link** do oficjalnego skill / repo
- **Mapowanie na agenta** z [AGENTS.md](../AGENTS.md) (Frontend / Backend / DATABASE / DEVOPS / SECURITY / QA / DOCS)
- **Tier:** S (instaluj teraz), A (warto rozważyć), B (przyszłe potrzeby)

**Instalacja oficjalnych skills Anthropic:**

```bash
# W Claude Code
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
/plugin install document-skills@anthropic-agent-skills
```

**Skills od dev teams (Vercel, Sentry, Trail of Bits, etc.):**

Większość skills jest dostępna przez [officialskills.sh](https://officialskills.sh) — można je klonować lub instalować przez `/plugin marketplace add <github-org>/<repo>`.

---

## TIER S — instaluj teraz (idealny match dla SmartHouse)

### FRONTEND Agent

| Skill                     | Repo                                                                                                    | Co daje                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **next-best-practices**   | [vercel-labs/skills](https://officialskills.sh/vercel-labs/skills/next-best-practices)                 | Oficjalne Next.js patterns od Vercel — App Router, Server Components, Server Actions                 |
| **next-cache-components** | [vercel-labs/skills](https://officialskills.sh/vercel-labs/skills/next-cache-components)               | Caching strategies (kluczowe dla Sheets read p95 < 1.5s)                                            |
| **react-best-practices**  | [vercel-labs/skills](https://officialskills.sh/vercel-labs/skills/react-best-practices)                | React 19 patterns, hooks, state                                                                      |
| **composition-patterns**  | [vercel-labs/skills](https://officialskills.sh/vercel-labs/skills/composition-patterns)                | Reusable component composition                                                                       |
| **shadcn-ui**             | [google-labs-code/skills](https://officialskills.sh/google-labs-code/skills/shadcn-ui)                 | Build UI z shadcn/ui (dokładny match stacku)                                                         |
| **frontend-design**       | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)             | UI/UX guidelines, design tokens                                                                      |
| **theme-factory**         | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/theme-factory)               | Profesjonalne motywy (już zainstalowane w naszym Claude Code)                                        |

### BACKEND Agent

| Skill           | Repo                                                                                        | Co daje                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **gws-sheets**  | [googleworkspace/skills](https://officialskills.sh/googleworkspace/skills/gws-sheets)       | **Krytyczny** — Google Sheets read/write best practices (primary store SmartHouse)                  |
| **gws-shared**  | [googleworkspace/skills](https://officialskills.sh/googleworkspace/skills/gws-shared)       | Auth flow + global flags dla Google Workspace API                                                    |
| **mcp-builder** | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/mcp-builder)     | Tworzenie własnego MCP servera (gdyby SmartHouse miał API zewnętrzne)                                |

### DATABASE Agent

| Skill          | Repo                                                                                    | Co daje                                                                      |
| -------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **gws-sheets** | [googleworkspace/skills](https://officialskills.sh/googleworkspace/skills/gws-sheets)   | Patterns zapisu/odczytu Sheets (najważniejszy dla DATABASE Agent)            |
| **xlsx**       | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/xlsx)        | Excel/spreadsheet operations (zainstalowany lokalnie)                        |

### SECURITY Agent

| Skill                       | Repo                                                                                                    | Co daje                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **insecure-defaults**       | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/insecure-defaults)                   | Wykrywa hardcoded secrets, default credentials, weak crypto                               |
| **static-analysis**         | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/static-analysis)                     | CodeQL + Semgrep + SARIF toolkit (mamy już `static-analysis:semgrep` skill)               |
| **differential-review**     | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/differential-review)                 | Security-focused diff review (mamy już `differential-review:diff-review`)                 |
| **sharp-edges**             | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/sharp-edges)                         | Identyfikuje error-prone APIs i niebezpieczne konfiguracje                                |
| **audit-context-building**  | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/audit-context-building)               | Deep architectural context — przydatne przy zmianach Hot Files                            |
| **semgrep-rule-creator**    | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/semgrep-rule-creator)                 | Tworzenie własnych Semgrep rules (ESLint guard na delete-Sheets to wzorzec)               |

### QA Agent

| Skill                       | Repo                                                                                                    | Co daje                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **webapp-testing**          | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing)               | Playwright dla web apps (zainstalowany lokalnie)                    |
| **property-based-testing**  | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/property-based-testing)               | Property-based testing (mamy lokalnie)                              |
| **testing-handbook-skills** | [trailofbits/skills](https://officialskills.sh/trailofbits/skills/testing-handbook-skills)              | Fuzzers, sanitizers, static analysis                                |

### DEVOPS Agent

| Skill               | Repo                                                                                      | Co daje                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **web-perf**        | [cloudflare/skills](https://officialskills.sh/cloudflare/skills/web-perf)                 | Core Web Vitals audit (matches Performance Budgets w AGENTS.md)              |
| **sentry-nextjs-sdk** | [getsentry/skills](https://officialskills.sh/getsentry/skills/sentry-nextjs-sdk)       | Setup Sentry dla Next.js 13+ (App Router)                                    |
| **sentry-workflow** | [getsentry/skills](https://officialskills.sh/getsentry/skills/sentry-workflow)           | End-to-end production issue fix workflow                                     |

### DOCS Agent

| Skill             | Repo                                                                                        | Co daje                                      |
| ----------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **skill-creator** | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/skill-creator)   | Tworzenie własnych SmartHouse-specific skills |
| **doc-coauthoring** | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring) | Wspólne edytowanie dokumentów              |

---

## TIER A — warto rozważyć (specific use cases)

| Skill                                                                                                     | Kiedy użyć                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [auth0/auth0-nextjs](https://officialskills.sh/auth0/skills/auth0-nextjs)                                 | Tylko jeśli rozważamy migrację z iron-session na Auth0 (zobacz [ADR-002](./adr/0002-iron-session-instead-of-nextauth.md)) |
| [sentry-react-sdk](https://officialskills.sh/getsentry/skills/sentry-react-sdk)                           | Gdy chcemy track błędów per-component                                                                          |
| [sentry-create-alert](https://officialskills.sh/getsentry/skills/sentry-create-alert)                     | Gdy chcemy alerty Slack/email z produkcji                                                                      |
| [cloudflare/workers-best-practices](https://officialskills.sh/cloudflare/skills/workers-best-practices)   | Gdyby SmartHouse migrował z Firebase App Hosting na Cloudflare                                                 |
| [pdf](https://github.com/anthropics/skills/tree/main/skills/pdf)                                         | Gdy moduł Legalizacja będzie OCR-ować paszporty (zobacz `project_legalizacja_plan` w pamięci)                  |
| [trailofbits/firebase-apk-scanner](https://officialskills.sh/trailofbits/skills/firebase-apk-scanner)     | Gdyby SmartHouse miał aplikację mobilną Android                                                                |

---

## TIER B — przyszłe potrzeby

| Skill                                                                                         | Powód                                                                                     |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [apollographql/apollo-client](https://officialskills.sh/apollographql/skills/apollo-client)   | Gdy SmartHouse przejdzie na GraphQL (mało prawdopodobne — Sheets nie ma GraphQL endpoint) |
| [expo/\*](https://officialskills.sh/expo)                                                     | Gdy powstanie React Native app SmartHouse                                                 |
| [huggingface/\*](https://officialskills.sh/huggingface)                                       | ML workflows — np. AI klasyfikacja alertów                                                |

---

## Anthropic Cookbooks — wzorce (nie skills, ale referencje)

Z [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) — najwartościowsze recipes dla SmartHouse:

### Tool Use & Agents

- **[Sub-agents pattern](https://github.com/anthropics/anthropic-cookbook/blob/main/multimodal/using_sub_agents.ipynb)** — Haiku jako sub-agent + Opus jako orchestrator. Pasuje do struktury Multi-Agent w AGENTS.md
- **[Customer service agent](https://github.com/anthropics/anthropic-cookbook/blob/main/tool_use/customer_service_agent.ipynb)** — wzorzec dla coordinator-resident interaction
- **[SQL queries pattern](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/how_to_make_sql_queries.ipynb)** — adaptowalne na Google Sheets queries

### Performance / Cost

- **[Prompt caching](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/prompt_caching.ipynb)** — kluczowe dla zmniejszenia kosztów przy częstych zapytaniach o coordinator data
- **[JSON mode](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/how_to_enable_json_mode.ipynb)** — wymuszanie spójnych odpowiedzi

### Quality

- **[Automated evaluations](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/building_evals.ipynb)** — testowanie zmian w prompts dla agentów SmartHouse
- **[Moderation filter](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/building_moderation_filter.ipynb)** — wzorzec dla walidacji user-generated content

### Multimodal (relevant dla Legalizacja)

- **[Vision basics](https://github.com/anthropics/anthropic-cookbook/blob/main/multimodal/getting_started_with_vision.ipynb)** — OCR paszportów
- **[Form extraction](https://github.com/anthropics/anthropic-cookbook/blob/main/multimodal/how_to_transcribe_text.ipynb)** — wyciąganie pól z dokumentów
- **[PDF upload + summarization](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/pdf_upload_summarization.ipynb)** — zezwolenia na pracę

---

## Curated repository lists — meta-resources

| Repo                                                                            | Co tam jest                                                                                                                   |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | **1100+** kuratorskich skills od oficjalnych dev teamów (Anthropic, Vercel, Stripe, Cloudflare, Trail of Bits, Sentry...)  |
| [anthropics/skills](https://github.com/anthropics/skills)                       | 17 oficjalnych skills Anthropic                                                                                               |
| [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks)   | Notebooks z patterns Claude API                                                                                               |
| [bytefer/awesome-shadcn-ui](https://github.com/bytefer/awesome-shadcn-ui)       | shadcn/ui ecosystem — komponenty, tematy, blocks                                                                              |
| [bytefer/awesome-nextjs](https://github.com/bytefer/awesome-nextjs)             | Next.js — biblioteki, tutoriale, boilerplates                                                                                 |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Claude Code workflow tools (uwaga: w trakcie reorganizacji)                                                             |

---

## Skills już zainstalowane lokalnie (sprawdzone w bieżącym Claude Code)

Te skills są już dostępne w tym środowisku Claude Code — nie trzeba ich instalować ponownie:

**Anthropic official:**

- `anthropics/theme-factory`, `anthropics/canvas-design`, `anthropics/algorithmic-art`
- `anthropics/frontend-design`, `anthropics/web-artifacts-builder`
- `anthropics/webapp-testing`, `anthropics/skill-creator`, `anthropics/mcp-builder`
- `anthropics/brand-guidelines`, `anthropics/internal-comms`
- `anthropics/docx`, `anthropics/pdf`, `anthropics/pptx`, `anthropics/xlsx`
- `anthropics/doc-coauthoring`, `anthropics/slack-gif-creator`
- `anthropics/claude-api`

**Trail of Bits:**

- `static-analysis:semgrep`, `static-analysis:codeql`, `static-analysis:sarif-parsing`
- `differential-review:diff-review`, `differential-review:differential-review`
- `mutation-testing:mutation-testing`, `property-based-testing:property-based-testing`
- `second-opinion:second-opinion`

**Custom (już dostępne):**

- `regression-surface-map` — mapa regresji przy zmianach
- `preflight-check` — pre-implementation checklist
- `sheets-safe-write` — guard przed kasowaniem Sheets (nasze custom)
- `api-auth-guard` — sprawdza auth na endpoints
- `build-gate` — gate `npm run build`
- `repomix-explorer:explore-local`, `repomix-explorer:explore-remote`
- `cybersecurity-skills:*` — 800+ security skills

---

## Rekomendowana ścieżka instalacji

### Krok 1 — najpilniejsze (15 min)

```bash
# Już zainstalowane skills → nie ruszaj.
# Dodaj jako marketplace:
/plugin marketplace add anthropics/skills
/plugin marketplace add VoltAgent/awesome-agent-skills
```

### Krok 2 — Vercel Next.js skills (priorytet dla FRONTEND Agent)

Vercel Labs publikuje swoje skills jako część [vercel-labs](https://github.com/vercel-labs) na GitHub. Klonuj `vercel-labs/skills` jeśli organizacja ma publiczny repo, w przeciwnym razie instaluj per-skill przez officialskills.sh.

### Krok 3 — Google Workspace CLI dla DATABASE Agent

```bash
# gws-sheets to najważniejszy dla SmartHouse — primary store to Sheets
# Klonuj lub instaluj jako plugin gdy bedzie publiczny marketplace
```

### Krok 4 — Sentry monitoring (przyszłość)

Gdy zdecydujemy o produkcyjnym monitoringu błędów:

```bash
# sentry-nextjs-sdk dla Next.js 14 App Router
```

---

## Maintenance tej listy

- **Co 30 dni:** DOCS Agent przegląda nowe skills w VoltAgent/awesome-agent-skills i Anthropic
- **Po major upgrade stacku** (Next.js 15, React 20): aktualizacja Tier S
- **Każdy nowy ADR** może wprowadzić zmiany w "warto rozważyć" (np. ADR o monitoringu → Sentry skills do Tier S)

## Sources

- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — główne źródło curated skills
- [anthropics/skills](https://github.com/anthropics/skills) — oficjalne skills Anthropic
- [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) — wzorce użycia Claude API
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — Claude Code resources
- [bytefer/awesome-shadcn-ui](https://github.com/bytefer/awesome-shadcn-ui) — shadcn/ui ecosystem
- [bytefer/awesome-nextjs](https://github.com/bytefer/awesome-nextjs) — Next.js ecosystem
- [Top 50 Claude Skills (2026)](https://www.blockchain-council.org/claude-ai/top-50-claude-skills-and-github-repos/) — ranking 2026
