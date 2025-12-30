This document provides guidelines for both human contributors and AI agents working on SmartHouse. For technical context and architecture details, also see .github/copilot-instructions.md.

Note: This document defines working standards for stability, security, accessibility, and code quality with minimal scope changes.

Table of Contents
General Rules (Stability and Minimal Scope)

Project Structure and Responsibilities

Import Standards (Absolute Aliases vs. Relative Paths)

AI Operating Rules

AI Output Contract (XML)

TypeScript, Lint, Format, and Build (Quality Requirements)

SSR/CSR/Server Actions and Secret Security

Google Sheets Integration (Security and Reliability)

UI/UX, A11y, and Tailwind

Performance and Performance Budget

Testing and Observability

Checklists (Pre-PR and Pre-Deployment)

Minimum Scripts (Recommended)

Date Handling Standard (and Excel Export)

Empty/Nullable Field Handling Rules

1. General Rules (Stability and Minimal Scope)
Treat every change as critical. Limit the scope to the absolute minimum required by the task.

Do not modify unrelated components, configuration, or dependencies without explicit necessity.

Every change must pass: lint, typecheck, build, and local dev runtime validation.

Prefer small, readable PRs with a clear description and a full diff.

2. Project Structure and Responsibilities
Business Logic:

src/lib/actions.ts – Server Actions/handlers.

src/lib/sheets.ts – Google Sheets integration.

Note: These modules are "server-only" and must not be imported in client-side code.

UI:

General Components: src/components/ui

Functional Components: src/components

Global State:

src/components/main-layout.tsx – MainLayoutContext (providing data and operations, e.g., handleUpdateSettings, handleAddEmployee).

Routing:

According to Next.js conventions (app/ or pages/ – adjust to the repository's actual structure).

3. Import Standards (Absolute Aliases vs. Relative Paths)
Priorities:

Absolute Aliases (Preferred): e.g., import { Foo } from '@/utils/Foo'

Relative (Local): Only for imports from the same folder or close proximity (max 1–2 levels ../).

Never: Long chains of ../../../ – use aliases instead.

Clarity Rules:

If an index.ts/tsx exists in a directory, import the directory (without /index).

Omit file extensions if the bundler allows it.

Change import paths only when necessary (e.g., moving a file). Verify that the target file exists and that all tests pass.

4. AI Operating Rules
Minimal Scope:

Do not touch files outside the task scope.

Do not perform broad refactoring without an explicit request.

Full Files:

When modifying a file, return the entire final content of the file (no diffs), in the XML format described in Section 5.

No Import Errors:

Do not generate code that will cause "Module not found" or type resolution errors.

Internal Validation:

Before sending the response, mentally "run" npm run lint, npm run typecheck, npm run build. The code must pass.

Strict Types:

Use explicit types and interfaces. Avoid any, unless it is a conscious, justified decision with a comment.

Client/Server Boundary:

Do not import server libraries (google-auth-library, google-spreadsheet) in client components ("use client").

All work with secrets—only on the server.

Stability and Compliance:

Respect existing component APIs and type contracts. Introduce breaking changes only with justification and migration steps.

Performance-First:

Use dynamic import for heavy libraries (e.g., recharts, xlsx) and load them only on the client when needed.

A11y-First:

Use semantic HTML, correct ARIA roles, and focus management (especially when using Radix UI).

5. AI Output Contract (XML)
Every proposed file change MUST be returned in the XML format below. Each modified file is a separate <change> node. The file content must be complete (full file), enclosed in CDATA.

XML

<changes>
  <description>[Brief description of the changes being made]</description>
  <change>
    <file>[ABSOLUTE, FULL path to the file, e.g., /src/lib/sheets.ts]</file>
    <content><![CDATA[
[FULL, FINAL FILE CONTENT HERE - no abbreviations, no diffs]
]]></content>
  </change>
</changes>
Requirements:

Use absolute paths from the repository root (e.g., /CONTRIBUTING.md, /src/components/Button.tsx).

Do not omit fragments (no elisions). Always provide the full content.

Do not add comments outside the XML structure that could disrupt the parser.

6. TypeScript, Lint, Format, and Build (Quality Requirements)
TypeScript:

Prefer: "strict": true, noImplicitAny, noUncheckedIndexedAccess, exactOptionalPropertyTypes.

Add types for the environment (e.g., env.d.ts) and for server-only modules, if used.

ESLint:

Compliance with eslint-config-next and @typescript-eslint.

Exclude .next, node_modules, dist, .turbo, coverage.

Recommended Scripts:

"typecheck": "tsc --noEmit"

"format": "prettier . --write"

"format:check": "prettier . --check"

"lint:ci": "eslint . --max-warnings=0"

Build:

The code must pass npm run build without errors or critical warnings.

Do not allow the import of server libraries on the client side.

7. SSR/CSR/Server Actions and Secret Security
Secrets and server libraries (google-auth-library, google-spreadsheet)—only in the server environment (API routes, Server Actions, route handlers).

Never use NEXT_PUBLIC_* for secrets.

Validate input data on the server side (zod) and return controlled errors (status, message).

Consider retry/backoff for 429/5xx errors. Log errors with context (without sensitive data).

8. Google Sheets Integration (Security and Reliability)
Authentication:

Prefer a Service Account. Credentials in environment variables (e.g., JSON base64 decoded on the server).

Ensure the Service Account has access to the appropriate sheets.

Isolation:

The src/lib/sheets.ts module must not be imported in client components.

Error Handling:

Wrap calls in try/catch, differentiate between 4xx/5xx errors, apply cautious retry/backoff.

Return readable messages for the UI; log details on the server side.

Validation:

Validate all input with zod schemas. Reject invalid data; do not trust the client.

9. UI/UX, A11y, and Tailwind
Core Principles & Layout:

Mobile-First: All UI development must follow a Mobile-First approach. Design for small screens first, then use min-width media queries (e.g., Tailwind's md:, lg:) for larger viewports.

Modern Layout: By default, use CSS Grid and Flexbox for main layout structures and component alignment. Avoid legacy layout methods (e.g., float).

A11y:

Semantic HTML5: Use correct elements (header, main, nav, footer).

ARIA: Use ARIA roles only where necessary. Use aria-live for dynamic messages (toast/status).

Radix UI: Ensure correct roles, aria-* attributes, and focus management. Use available patterns.

Responsiveness & Modern CSS:

Fluid Design: Use fluid typography and spacing (e.g., clamp(), min(), max()) where appropriate.

Relative Units: Prefer relative units (rem, em) over static px for scalability and accessibility.

CSS Variables: Actively use CSS Custom Properties (Variables) for theming (e.g., var(--primary-color)) when not handled by Tailwind's theme().

Logical Properties: Use Logical Properties (e.g., margin-inline-start instead of margin-left) for automatic RTL support.

Tailwind:

Apply utility-first, but maintain component readability and SRP (Single Responsibility Principle).

Ensure tailwind.config content includes all sources (app/, src/, components/**/).

Avoid FOUC/CLS (Flash of Unstyled Content / Cumulative Layout Shift).

Animations & Microinteractions:

Purpose: Animations must be subtle and purposeful (provide feedback, guide the user, confirm actions) and enhance the UX, not distract from it.

Performance: Prioritize 60 FPS. Animate transform (translate, scale, rotate) and opacity (GPU-friendly).

Avoid: Do not animate layout-heavy properties (e.g., width, height, margin) as they cause "reflow".

Modern APIs: Where appropriate, consider View Transitions API for page/view changes or Scroll-driven Animations for scroll-based effects.

Forms:

Use react-hook-form + zodResolver on the client.

All validation must be repeated on the server (e.g., in Server Actions).

10. Performance and Performance Budget
Code splitting and dynamic import for heavy libraries (recharts, xlsx) and rarely visited views.

Lazy-load images and components outside the viewport.

Avoid unnecessary re-renders (memo, useCallback/useMemo where appropriate).

Control bundle size. Eliminate unused dependencies and imports.

Preload/preconnect critical resources when justified.

11. Testing and Observability
Tests:

At least smoke tests for critical components and key flows (e.g., file upload, main forms).

Validate zod schemas—test example payloads (good/bad).

Observability:

Server-side logging with context (request id, user id – if available).

Consistent API error format (code, message, details?).

Be careful not to log secrets.

12. Checklists
Before Sending a PR

[ ] Changes are limited to the required files.

[ ] Code passes npm run lint, npm run typecheck, npm run build.

[ ] No server imports in client code.

[ ] Compliance with import standards (aliases > relative).

[ ] Data validation (zod) for endpoints/API.

[ ] UI/A11y checked (keyboard, aria, contrasts).

[ ] Dynamic import for heavy modules, if applicable.

Before Deployment

[ ] Environment variables are set (no secrets in NEXT_PUBLIC_*).

[ ] Service Account access to Google Sheets verified.

[ ] Monitoring/logs are working, errors are reported correctly.

[ ] No critical warnings in the build.

[ ] Performance and bundle size are acceptable.

13. Minimum Scripts (Recommended in package.json)
JSON

"typecheck": "tsc --noEmit",
"format": "prettier . --write",
"format:check": "prettier . --check",
"lint:ci": "eslint . --max-warnings=0"
14. Date Handling Standard (and Excel Export)
Goal: Unify date formatting and parsing throughout the project and avoid errors like "formatDate is not defined".

14.1 General Rules

Centralization: All date operations must be performed via common helpers in the module: /src/lib/date.ts.

Prohibited: Calling non-existent/unimported functions like formatDate in Excel export files or components. If formatting is needed—use functions from /src/lib/date.ts.

Library: We use date-fns. Do not call functions that do not exist in date-fns (e.g., formatDate is not a date-fns function). Instead, use format from date-fns or helpers from /src/lib/date.ts.

Types: Always operate on Date objects or safely parse string/number to Date before formatting.

14.2 Helper Contract (File /src/lib/date.ts must exist) The /src/lib/date.ts module must export at least the following:

formatDate(input: Date | string | number, pattern?: string): string

Default pattern: "yyyy-MM-dd"

Rules: If input is a string—try parseISO, otherwise new Date(input). If the date is invalid, return an empty string or throw a controlled error (depending on the use case).

formatDateTime(input: Date | string | number, pattern?: string): string

Default pattern: "yyyy-MM-dd HH:mm"

parseMaybeDate(input: Date | string | number): Date | null

Returns Date or null, without throwing exceptions.

isValidDate(input: unknown): boolean

true if it is a valid Date object (and not NaN).

All consumers (UI, API, Excel export) must import exclusively from @/lib/date.

14.3 Usage Rules in Excel Export (xlsx)

Formatting before saving:

Dates to Excel must be saved as formatted strings using formatDate or formatDateTime. Recommended UI formats: "dd.MM.yyyy" for dates, "dd.MM.yyyy HH:mm" for dates with time.

Input Validation:

If the date source is a string (e.g., from Google Sheets/API), always use parseMaybeDate and check isValidDate before formatting. If the date is invalid—write an empty string or mark it in the report as "Invalid Date".

Imports:

Prohibited: Local definition of a function named formatDate in export files. Always import from @/lib/date.

Column Consistency:

Date columns in the report must use one consistent format (e.g., "dd.MM.yyyy").

14.4 AI Rules (Date and Excel)

If you see a call to formatDate without an import from @/lib/date, add the correct import and use the helper.

If the helper does not exist—first create /src/lib/date.ts according to the contract in section 14.2, and only then modify the export files.

Do not replace formatDate with non-existent date-fns functions. date-fns uses the format function. Helpers wrap format and parsing.

Before returning changes, mentally verify that the @/lib/date import is correct (aliases) and that the code will pass lint/typecheck/build.

14.5 Checklist (Dates/Excel)

[ ] File /src/lib/date.ts exists and exports: formatDate, formatDateTime, parseMaybeDate, isValidDate.

[ ] Everywhere I format dates (UI, API, Excel), I use helpers from @/lib/date.

[ ] String dates are always parsed (parseMaybeDate), and unparseable ones are treated as empty.

[ ] A consistent format is used in Excel ("dd.MM.yyyy" or "dd.MM.yyyy HH:mm").

[ ] No local, ad-hoc formatDate functions in other files.

Additional Recommended Items (Optional)

ESLint rule/grep in CI:

Block the use of “formatDate(” without an import from @/lib/date.

Block the redefinition of “function formatDate(” outside /src/lib/date.ts.

Unit Tests for /src/lib/date.ts:

Correct formatting of ISO/string/number dates.

Behavior with invalid dates (null, "abc", NaN).

Documentation in README: (short snippets on how to format dates and import helpers).

15. Empty/Nullable Field Handling Rules
15.1 Definitions and General Rules

Allowed Empty States: null, undefined, empty string "" (after trim: "" is treated as empty).

No Error: An empty field does not generate a validation error, unless the field is marked as required.

Normalization: Before further processing, all text fields are trimmed. Empty values are normalized to null or "" according to context.

Consistency: The same attribute (e.g., last name, date) must have consistent emptiness rules across the entire application (UI, API, Excel).

15.2 Validation (zod) – Contract

Optional Fields:

Use z.string().optional().transform(v => (v?.trim() ? v.trim() : "")) when you want to store "".

Or z.string().optional().transform(v => (v?.trim() ? v.trim() : null)) when you want to store null.

Required Fields:

Use z.string().min(1, "Required Field"), but apply transform/trim beforehand.

Optional Dates:

Use z.union([z.string(), z.date()]).optional().transform(v => { if (!v) return null; // string → try parseISO/new Date; if invalid, return null // ... })

Never throw an error solely because a field is empty if it is marked as optional in the schema.

15.3 UI (Forms and Views)

Forms:

For optional fields, do not show a validation error for an empty value.

Display empty values as a placeholder or an empty input.

Table/Lists:

Render empty values as "—", "N/A", or an empty cell, consistent with the design system.

Do not use red toasts/alerts only because of a missing value.

A11y:

For descriptive elements (e.g., aria-label), do not insert "undefined" or "null". Use meaningful fallbacks, e.g., "No data available".

15.4 Excel Export (xlsx) – Empty Fields

Text:

If the value is empty after normalization → save "" (empty cell) or "—" (if a visual placeholder is required).

Dates:

If parseMaybeDate returns null → save an empty string "" (do not format).

Do not throw an error; the export must be stable with mixed/incomplete data.

Numbers:

If the field is optional and missing a value → save "" (not 0, unless the domain requires 0 as a default).

Required Columns:

If a column is domain-required but the value is empty → do not interrupt the export. Save "" and include warnings in a report (e.g., a list in logs/console or report metadata), but do not treat it as a critical error.

15.5 Backend/API

In Endpoints and Server Actions:

Normalize empty inputs: empty strings → "", null/undefined → null (consistent with the model).

Validate with the zod schema: optional fields do not generate errors.

Do not return 4xx solely because an optional field is empty.

Logging:

Log only unexpected errors (e.g., type inconsistent with contract, parsing error in a required field). Empty optional fields are not errors.

15.6 AI Rules (Empty Handling)

If you see an error generated by an empty field, and the field is not required—remove the error and apply normalization + a quiet fallback ("" or null).

For date format: if the value is empty or unparseable → return "" without a toast error. In the UI, you can show a subtle "Missing" badge.

In Excel export, never interrupt the process due to empty fields. Apply fallbacks and continue.

Before responding, verify that zod schemas allow emptiness for fields marked as optional.

15.7 Checklist (Empty/Nullable)

[ ] Zod schemas differentiate between required vs optional and do not return errors for empty optional fields.

[ ] UI does not show toast errors for empty optional fields—it uses placeholders.

[ ] Excel Export saves "" for empty optional fields (text/numbers/dates).

[ ] parseMaybeDate returns null for empty/unparseable values; formatDate returns "" for null.

[ ] No flow (import/export/submit) interruption due to empty optional fields.

Final Notes
If the task requires changing data structures or APIs, describe the migration and the impact on existing screens/components.

Prefer clarity over "cleverness." The code must be easy for the team to maintain.