# CLAUDE.md — AI Agent Configuration

> **This file is the entry point for all AI coding assistants** (Claude, Gemini, Cursor, Copilot, etc.)
> working in this repository. Read it fully before touching any code.

---

## 🔗 Primary Reference

All architectural rules, agent roles, communication protocols, and project conventions
are defined in the **Agent Registry**:

**➡️ [`AGENTS.md`](./AGENTS.md)**

You MUST read `AGENTS.md` before starting any task. It is the single source of truth for:

- Multi-agent system architecture (Orchestrator + 5 specialized agents)
- Each agent's file scope and responsibilities
- Inter-agent communication format
- Parallel vs. sequential execution rules
- Team-wide coding rules
- Technology stack overview

---

## ⚡ Quick Reference — Tech Stack

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Framework   | Next.js 14 (App Router)                 |
| Language    | TypeScript                              |
| Styling     | **Tailwind CSS + shadcn/ui only**       |
| Backend     | Next.js API Routes + Firebase Functions |
| Database    | **Google Sheets** (primary data store)  |
| Auth        | Firebase Authentication                 |
| Hosting     | Firebase App Hosting                    |
| Tests       | Jest + Vitest + Playwright              |
| Linter      | ESLint + Prettier                       |

---

## 🚦 Before You Write a Single Line of Code

Follow this checklist on every session:

- [ ] Read [`AGENTS.md`](./AGENTS.md) — understand your role and boundaries
- [ ] Identify which **agent role** applies to your task (Frontend / Backend / Database / DevOps / QA)
- [ ] Check existing components in `components/ui/` before creating new ones
- [ ] Confirm the endpoint / schema / type already exists before implementing UI for it
- [ ] Apply **Mobile First** design — always start from the smallest breakpoint

---

## 🏗️ Project Structure (key paths)

```markdown
SmartHouse/
├── src/
│   ├── app/              # Next.js App Router (pages, layouts, API routes)
│   │   └── api/          # Backend: API Routes — Backend Agent scope
│   └── components/       # UI components — Frontend Agent scope
├── components/           # Shared shadcn/ui primitives
├── lib/                  # Utilities, Firebase helpers, hooks
├── tests/                # Playwright E2E tests — QA Agent scope
├── scripts/              # Build/deploy scripts — DevOps Agent scope
├── firebase.json         # Firebase config
├── apphosting.yaml       # App Hosting config
├── AGENTS.md             # ← Full agent rules (READ THIS)
├── AI_CONTEXT.md         # ← Live project snapshot (Auto-generated)
└── CLAUDE.md             # ← You are here
```

---

## 🏗️ Live Project Context

For a real-time snapshot of dependencies, git status, and the full file tree, refer to:

**➡️ [`AI_CONTEXT.md`](./AI_CONTEXT.md)**

This file is automatically updated on every `git commit`. Use it to understand the current state of the codebase without manual exploration.

---

## 📋 Critical Project Rules (summary)

These rules are **non-negotiable**. Full details in `AGENTS.md`.

1. **No agent modifies files outside its scope** without Orchestrator approval
2. **No plain CSS / inline styles** — use Tailwind utility classes exclusively
3. **Every new feature needs a test** — at minimum one integration test (QA Agent)
4. **Every API route must verify Firebase Auth token** (Backend Agent)
5. **Schema changes must be backward-compatible** or include a migration (Database Agent)
6. **Never deploy without a passing build** — `npm run build` must be green (DevOps Agent)
7. **Blocker > guessing** — if uncertain, raise a blocker instead of improvising
8. **🚨 ABSOLUTE RULE — Google Sheets data is SACRED. NEVER write code that deletes data from Google Sheets.** This means:
   - NEVER call `row.delete()`, `sheet.clearRows()`, or `sheet.deleteRows()` — ESLint will block builds that contain these
   - NEVER call `getSheet()` directly for write operations — use `getSafeSheet()` from `lib/safe-sheets.ts`
   - If a feature requires deletion, STOP and ask the owner for approval first
   - Existing delete calls in `src/lib/actions.ts` have `// eslint-disable-next-line` comments — do NOT copy this pattern without owner approval

---

## 🔔 Push Notifications (special context)

This project uses **native Web Push (VAPID)** — NOT Firebase Cloud Messaging.

- Subscription logic: `lib/push/` and `src/app/api/push/`
- VAPID keys are stored in Firebase App Hosting secrets, never in `.env` files committed to git
- Do not reintroduce FCM-based push — it was removed intentionally

---

## 🗄️ Database (special context)

Primary data store is **Google Sheets** (via API), not Firestore, for most business data.
Firestore is used for: authentication state, push subscriptions, and real-time listeners only.

Always check `lib/` for existing Sheet helpers before writing new data-access code.

---

## 🚀 Common Commands

```bash
# Development server
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Unit tests
npm run test

# E2E tests
npx playwright test

# Production build (validate before deploy)
npm run build
```

---

### Maintenance

Last updated: 2026-04-06 | Maintained by project owner
