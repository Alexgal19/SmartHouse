This document provides guidelines for both human contributors and AI agents working on SmartHouse. For technical context and architecture details, also see .github/copilot-instructions.md and PULL_REQUEST_TEMPLATE.md.

Note: This document defines working standards for stability, security, accessibility, and code quality with minimal scope changes.

## Table of Contents
1.  [General Rules (Stability and Minimal Scope)](#1-general-rules-stability-and-minimal-scope)
2.  [Zero-Error Protocol (Syntax and Type Correctness MANDATE)](#2-zero-error-protocol-syntax-and-type-correctness-mandate)
3.  [Project Structure and Responsibilities](#3-project-structure-and-responsibilities)
4.  [Import Standards (Absolute Aliases vs. Relative Paths)](#4-import-standards-absolute-aliases-vs-relative-paths)
5.  [AI Operating Rules](#5-ai-operating-rules)
6.  [AI Output Contract (XML)](#6-ai-output-contract-xml)
7.  [TypeScript, Lint, Format, and Build (Quality Requirements)](#7-typescript-lint-format-and-build-quality-requirements)
8.  [SSR/CSR/Server Actions and Secret Security](#8-ssrcsrserver-actions-and-secret-security)
9.  [Google Sheets Integration (Security and Reliability)](#9-google-sheets-integration-security-and-reliability)
10. [UI/UX, A11y, and Tailwind](#10-uiux-a11y-and-tailwind)
11. [Performance and Performance Budget](#11-performance-and-performance-budget)
12. [Testing and Observability](#12-testing-and-observability)
13. [Checklists (Pre-PR and Pre-Deployment)](#13-checklists-pre-pr-and-pre-deployment)
14. [Minimum Scripts (Recommended)](#14-minimum-scripts-recommended)
15. [Date Handling Standard (and Excel Export)](#15-date-handling-standard-and-excel-export)
16. [Empty/Nullable Field Handling Rules](#16-emptynullable-field-handling-rules)

---

### 1. General Rules (Stability and Minimal Scope)
- Treat every change as critical. Limit the scope to the absolute minimum required by the task.
- Do not modify unrelated components, configuration, or dependencies without explicit necessity.
- Every change must pass: lint, typecheck, build, and local dev runtime validation.
- Prefer small, readable PRs with a clear description and a full diff.

---

### 2. Zero-Error Protocol (Syntax and Type Correctness MANDATE)
This is the most important section. Failure to comply with this protocol is a critical error.

- **2.1 Absolute Priority:** Code correctness (syntax and types) is the **highest priority**, above speed, brevity, or any other heuristic. It is better to be slow and correct than fast and wrong.
- **2.2 Pre-Submission Internal Validation (MANDATORY):** Before generating any XML output, I **MUST** perform an internal, mental simulation of the following commands on the modified code:
    1.  **`tsc --noEmit` (TypeScript Type Check):** I must verify that there are no type errors. This includes checking function signatures, variable assignments, and component properties.
    2.  **`eslint .` (Linting):** I must verify that the code adheres to all linting rules, paying special attention to syntax errors like unexpected tokens (`>`, `}`), missing commas, or incorrect function declarations.
- **2.3 No Guessing:** If a type is complex or unclear, I must not guess. I will re-analyze the existing codebase (`src/types.ts`, related components) to infer the correct type before proceeding.
- **2.4 Full File Integrity:** When modifying a file, I am responsible for the **entire file's integrity**. The final code in the `<content>` block must be a complete, runnable, and error-free version of that file.
- **2.5 Deep Contextual Analysis (MANDATORY):** When modifying code that involves interactions (e.g., function calls, component props, server actions), I **MUST** analyze the **entire data flow**. I will verify that all required arguments, props, and context values are correctly and completely passed to the destination function or component. This is especially critical for server actions that rely on a complete data context from the client.
- **2.6 Configuration File Integrity (MANDATORY):** When modifying configuration files (e.g., `next.config.js`, `tailwind.config.ts`, `tsconfig.json`), I **MUST** verify the correctness of the schema and structure against the official documentation for the respective tool or framework. I will not assume a configuration structure.

---

### 3. Project Structure and Responsibilities

- **Business Logic & Server Actions:**
  - `src/lib/actions.ts` – The single source of truth for all server-side data mutations (add, update, delete).
  - `src/lib/sheets.ts` – Handles the low-level communication with the Google Sheets API.
  - `src/lib/auth.ts` & `src/lib/session.ts` – Manage user authentication and session state.
  - **Note:** These modules are "server-only" and must not be imported in client-side code.

- **UI & Components:**
  - `src/components/ui/` – Contains reusable, primitive UI components (e.g., Button, Card, Input) based on Shadcn UI.
  - `src/components/` – Contains higher-level, business logic components (e.g., `dashboard-view.tsx`, `entity-view.tsx`).
  - `src/app/` – Contains Next.js page components, layouts, and route handlers.

- **Global State & Context:**
  - `src/components/main-layout.tsx` – Provides a global `MainLayoutContext` to the application. This component is responsible for fetching all initial data and making data and server actions (imported from `src/lib/actions.ts`) available to all child components via the `useMainLayout` hook.

- **Client-Side Logic:**
    - `src/hooks/` - Contains custom client-side React hooks (e.g., `useIsMobile`, `useCopyToClipboard`).

---

### 4. Import Standards (Absolute Aliases vs. Relative Paths)
- **Priorities:**
  1.  **Absolute Aliases (Preferred):** e.g., `import { Foo } from '@/utils/Foo'`
  2.  **Relative (Local):** Only for imports from the same folder or close proximity (max 1–2 levels `../`).
- **Never:** Long chains of `../../../` – use aliases instead.
- **Clarity Rules:**
  - If an `index.ts/tsx` exists in a directory, import the directory (without `/index`).
  - Omit file extensions if the bundler allows it.
  - Change import paths only when necessary (e.g., moving a file). Verify that the target file exists and that all tests pass.

---

### 5. AI Operating Rules
- **Minimal Scope:**
  - Do not touch files outside the task scope.
  - Do not perform broad refactoring without an explicit request.
- **Full Files:**
  - When modifying a file, return the entire final content of the file (no diffs), in the XML format described in Section 5.
- **No Import Errors:**
  - Do not generate code that will cause "Module not found" or type resolution errors.
- **Internal Validation:**
  - Before sending the response, mentally "run" `npm run lint`, `tsc --noEmit`, and `npm run build`. The code must pass.
- **Strict Types:**
  - Use explicit types and interfaces. Avoid `any`, unless it is a conscious, justified decision with a comment.
- **Client/Server Boundary:**
  - Do not import server libraries (`google-auth-library`, `google-spreadsheet`) in client components (`"use client"`).
  - All work with secrets—only on the server.
- **Stability and Compliance:**
  - Respect existing component APIs and type contracts. Introduce breaking changes only with justification and migration steps.
- **Performance-First:**
  - Use `dynamic` import for heavy libraries (e.g., `recharts`, `xlsx`) and load them only on the client when needed.
- **A11y-First:**
  - Use semantic HTML, correct ARIA roles, and focus management (especially when using Radix UI).

---

### 6. AI Output Contract (XML)
Every proposed file change MUST be returned in the XML format below. Each modified file is a separate `<change>` node. The file content must be complete (full file), enclosed in `CDATA`.

```xml
<changes>
  <description>[Brief description of the changes being made]</description>
  <change>
    <file>[ABSOLUTE, FULL path to the file, e.g., /src/lib/sheets.ts]</file>
    <content><![CDATA[
[FULL, FINAL FILE CONTENT HERE - no abbreviations, no diffs]

// All code must be correctly escaped.
// For example, this CDATA block is inside an XML file.
// The code inside must not contain a `` sequence.
// If it does, it must be escaped, for example by splitting it.
// Like this: `const endOfCdata = "]]" + ">";`
]]>
    