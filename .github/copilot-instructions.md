# AI Copilot Instructions for SmartHouse

This document provides guidance for AI coding agents (like GitHub Copilot, Claude, etc.) working on the SmartHouse codebase.

## Project Overview

**SmartHouse** is a Next.js 14 (App Router) web application for managing residential properties, employees, and related operations. The stack includes TypeScript, React 18, Tailwind CSS, and integrations with Google Sheets and authentication via `iron-session`.

**Repository Path:** `/Users/oleksandr/Documents/SmartHouse`

---

## File Structure & Key Locations

```
SmartHouse/
├── .github/                    # GitHub configuration (this file, PR templates)
├── src/
│   ├── app/                    # Next.js App Router pages & layouts
│   │   ├── page.tsx            # Home page / login redirect
│   │   ├── layout.tsx          # Root layout with auth wrapper
│   │   ├── dashboard/          # Dashboard routes
│   │   └── login/              # Login page
│   ├── components/
│   │   ├── ui/                 # Radix UI / Shadcn primitives (reusable)
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── add-employee-form.tsx
│   │   ├── entity-view.tsx
│   │   ├── housing-view.tsx
│   │   └── settings-view.tsx
│   ├── hooks/                  # Client-only React hooks
│   │   ├── use-toast.ts
│   │   ├── use-mobile.ts
│   │   └── use-copy-to-clipboard.ts
│   ├── lib/
│   │   ├── auth.ts             # Session & authentication (iron-session)
│   │   ├── actions.ts          # Server actions (forms, data mutations)
│   │   ├── sheets.ts           # Google Sheets integration
│   │   ├── session.ts          # Session utilities
│   │   └── utils.ts            # Shared utilities
│   └── types/
│       ├── types.ts            # Global type definitions
│       └── recharts-extend.d.ts # Chart type extensions
├── public/
│   ├── sw.js                   # Service Worker (PWA)
│   └── manifest.json           # PWA manifest
├── tailwind.config.ts          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
├── next.config.mjs             # Next.js config
├── package.json                # Dependencies & scripts
└── README.md                   # Project README
```

---

## Build & Development Scripts

All scripts use **npm** as the package manager. Run from project root:

```bash
# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting (ESLint, TypeScript)
npm run lint

# Fix fixable linting issues
npm run lint:fix
```

**Node Version Requirement:** ≥18.17.0 (see `package.json` engines field)

---

## Critical Dependencies & Integration Points

### Authentication (`src/lib/auth.ts`)
- Uses **iron-session** for encrypted session management
- Session middleware wraps all authenticated routes
- Server actions in `src/lib/actions.ts` call `getSession()` to access user context

### Google Sheets Integration (`src/lib/sheets.ts`)
- Uses **google-spreadsheet** and **google-auth-library** libraries
- Syncs employee/housing data from Google Sheets
- Requires OAuth credentials (likely stored in `.env.local`)
- Server actions in `src/lib/actions.ts` call sheet methods to read/write data

### UI Component Library
- **Radix UI** primitives + **Shadcn** wrapper components in `src/components/ui/`
- **Tailwind CSS** for styling (config in `tailwind.config.ts`)
- Always reuse UI components from `src/components/ui/` rather than creating new ones
- Common components: Button, Dialog, Form, Card, Table, Tabs, etc.

### PWA & Service Worker (`public/sw.js`)
- Service Worker for offline support and caching
- Manifests in `public/manifest.json`
- Workbox integration for precaching

---

## Coding Conventions

1. **Component Organization:**
   - Place UI primitives in `src/components/ui/`
   - Place business logic components in `src/components/`
   - Place page-specific components in `src/app/[route]/` alongside pages

2. **Server Actions:**
   - Define server-side mutations in `src/lib/actions.ts`
   - Use `"use server"` directive at file or function level
   - Always call `getSession()` at the start to validate user context
   - Return typed responses for client-side error handling

3. **Type Safety:**
   - Define types in `src/types/types.ts` for global models (Employee, Housing, etc.)
   - Use `zod` for runtime validation of form data
   - Avoid `any` types—use union types or generics instead

4. **Styling:**
   - Use Tailwind utility classes in JSX
   - Use `clsx` or `classNames` to conditionally merge Tailwind classes
   - Avoid inline styles except for dynamic values

5. **Hooks & State:**
   - Client-only hooks live in `src/hooks/`
   - Use `useCallback` and `useMemo` to prevent unnecessary re-renders
   - Use React Hook Form for complex forms (already imported in form components)

---

## Build & Test Status

### Last Build Results (npm run build)
✅ **Build: SUCCESS** — All pages compiled and optimized.

Routes:
- `/` (static)
- `/dashboard` (dynamic, server-rendered)
- `/login` (static)
- `/_not-found` (static)

### Last Lint Results (npm run lint)
⚠️ **Lint: 88 issues found** (64 errors, 24 warnings) — after `npm run lint:fix`
- **Main Issues:** Excessive use of `any` type in `lib/actions.ts`, `lib/sheets.ts`, `src/components/ui/chart.tsx`, `tailwind.config.ts`
- **Fixed:** `prefer-const` error in `src/lib/sheets.ts` (auto-fixed)
- **Remaining:** 64 `any` type errors require manual annotation (union types, generics, or interfaces)
- **Service Worker:** ESLint config issue with workbox globals (false positives; SW works at runtime)
- **Unused Imports/Vars:** Several components import types or define variables that aren't used; can clean up in next refactor

### Missing Dependency (FIXED)
- ❌ **Error:** `iron-session` was imported but not in `package.json`
- ✅ **Fix Applied:** `npm install iron-session` (5 packages added)

### Auto-fix Applied
- ✅ **Fixed:** Ran `npm run lint:fix` to auto-correct `prefer-const` warning in `src/lib/sheets.ts`

---

## Common Tasks for AI Agents

### Adding a New Feature
1. Define types in `src/types/types.ts` (extend global models as needed)
2. Create UI components in `src/components/ui/` (reusable primitives)
3. Create feature components in `src/components/`
4. Add server actions to `src/lib/actions.ts` for mutations
5. Wire form + actions together in page components
6. Run `npm run lint:fix` to auto-fix issues, then `npm run build` to validate

### Fixing Lint Errors
- Run `npm run lint:fix` to auto-fix issues (already applied; fixed prefer-const)
- For `any` type errors: inspect the function signature and add proper types (union, generics, or interface)
- For unused imports: remove the import line
- For React Hook deps: add missing dependencies or use `// eslint-disable-next-line` if intentional

### Running Tests / Type Checking
- No Jest tests are currently configured; ESLint serves as static analysis
- TypeScript check: `npx tsc --noEmit` (or add as npm script if needed)

### Updating Dependencies
- Use `npm update` to bump patch/minor versions
- Use `npm install <package>@<version>` to install specific versions
- Always run `npm run build && npm run lint` after updates to catch breaking changes

---

## Environment & Credentials

- **`.env.local`:** Contains secrets (OAuth keys, API credentials)
  - Not committed to Git (in `.gitignore`)
  - Required for Google Sheets and auth integration
  - User must configure this locally

- **Node Modules:** 546 packages installed; largest: Radix UI, Next.js, TypeScript ESLint

---

## AI Agent Operating Rules

1. **Always validate before committing:**
   - Run `npm run build` (should succeed with no errors)
   - Run `npm run lint` (OK to have warnings for now; strive to reduce errors)
   - Prefer `npm run lint:fix` before pushing changes

2. **Respect architecture:**
   - Don't bypass the UI component library—reuse `src/components/ui/*`
   - Don't scatter business logic—keep it in `src/lib/` and actions
   - Don't put client-only code in server actions or vice versa

3. **Type safety first:**
   - Use TypeScript strictly; avoid `any` and `as` casts where possible
   - Define types before writing functions

4. **Feedback loop:**
   - Build errors block merges; lint warnings are OK short-term but should trend to zero
   - Test changes locally before suggesting patches

5. **Documentation:**
   - Add JSDoc comments to public server actions and utility functions
   - Update this file if new major integration points or conventions are added

---

## Useful Commands Quick Reference

```bash
# Dev workflow
npm run dev           # Start dev server
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix what you can

# Before committing
npm run build         # Full production build
npm run lint          # Final lint check

# Debugging
npm run lint "src/components/*.tsx"  # Lint one folder
npm --prefix /path/to/SmartHouse run build  # Run from anywhere
```

---

## Contact & Questions

If you encounter blocking issues (build fails, missing deps, etc.):
1. Check the "Build & Test Status" section above for known issues
2. Run `npm install` to ensure all dependencies are fresh
3. Check `.env.local` is properly configured (if auth/sheets errors occur)
4. Run `npm run lint:fix && npm run build` to attempt auto-recovery

---

**Last Updated:** 2025-11-10 (after npm install, build, and lint validation)
