# AI Copilot Instructions for SmartHouse

This document provides guidance for AI coding agents (like GitHub Copilot, Claude, etc.) working on the SmartHouse codebase. For a higher-level overview of working standards, see `AI-rules.md`.

## Project Overview

**SmartHouse** is a Next.js 14 (App Router) web application for managing residential properties, employees, and related operations. The stack includes TypeScript, React 18, Tailwind CSS, and integrations with Google Sheets and authentication via `iron-session`.

**Repository Path:** `/home/user/studio`

---

## File Structure & Key Locations

```
SmartHouse/
├── src/
│   ├── app/                    # Next.js App Router pages & layouts
│   │   ├── page.tsx            # Home page / login redirect
│   │   ├── layout.tsx          # Root layout
│   │   ├── dashboard/          # All authenticated routes & main client layout
│   │   └── login/              # Login page
│   ├── components/
│   │   ├── ui/                 # Reusable Shadcn UI primitives (Button, Card, etc.)
│   │   ├── dashboard/          # Dashboard-specific components (charts, KPIs)
│   │   ├── icons/              # Custom SVG icons
│   │   ├── add-employee-form.tsx
│   │   ├── add-non-employee-form.tsx
│   │   ├── address-form.tsx
│   │   ├── entity-view.tsx     # Main view for managing people (employees/non-employees)
│   │   ├── housing-view.tsx    # Main view for managing addresses and rooms
│   │   ├── settings-view.tsx   # Main view for app settings (admin only)
│   │   ├── header.tsx
│   │   ├── main-layout.tsx     # CRITICAL: Root authenticated layout, state/context provider
│   │   └── mobile-nav.tsx
│   ├── hooks/                  # Custom client-side React hooks
│   │   ├── use-toast.ts
│   │   ├── use-mobile.ts
│   │   └── use-copy-to-clipboard.ts
│   ├── lib/
│   │   ├── auth.ts             # Session & authentication (iron-session)
│   │   ├── actions.ts          # All server-side data mutations (add, update, delete)
│   │   ├── sheets.ts           # Low-level Google Sheets API communication
│   │   ├── session.ts          # Session configuration
│   │   └── utils.ts            # Shared utilities (e.g., `cn` for Tailwind)
│   └── types/
│       └── types.ts            # All global type definitions
├── tailwind.config.ts          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
├── next.config.js              # Next.js config
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
npm run start

# Linting (ESLint, TypeScript)
npm run lint

# Fix fixable linting issues
npm run lint:fix
```

---

## Critical Dependencies & Integration Points

### 1. Global State Management (`src/components/main-layout.tsx`)
- The `MainLayout` component is the **single source of truth** for all application data after login.
- It fetches all data (employees, settings, etc.) from the server via `getAllSheetsData()`.
- It provides this data, along with all server action functions (imported from `actions.ts`), to the entire component tree via the `MainLayoutContext` and `useMainLayout` hook.
- **Rule:** Do not fetch data directly in child components. Always consume it from the `useMainLayout` hook.

### 2. Authentication (`src/lib/auth.ts` & `src/lib/session.ts`)
- Uses **iron-session** for encrypted, cookie-based session management.
- The `DashboardLayout` (`src/app/dashboard/layout.tsx`) acts as a server-side guard, redirecting unauthenticated users.
- Server actions in `src/lib/actions.ts` get user context (UID, role) to authorize operations.
- The user's role (`admin`, `auditor`, `coordinator`) is stored in the session and dictates all permissions.

### 3. Google Sheets Integration (`src/lib/sheets.ts`)
- Uses **google-spreadsheet** and **google-auth-library** libraries.
- The `sheets.ts` file handles all low-level communication (reading/writing rows).
- The `actions.ts` file calls functions from `sheets.ts` to implement business logic.
- Requires OAuth credentials stored in environment variables.

### 4. UI Component Library
- Uses **Shadcn UI** components, which are built on **Radix UI** primitives.
- All general-purpose, reusable UI components are located in `src/components/ui/`.
- **Rule:** Always reuse components from `src/components/ui/` (e.g., `Button`, `Dialog`, `Card`, `Table`) rather than creating new primitives.

---

## Coding Conventions

1.  **Component Organization:**
    *   Place UI primitives in `src/components/ui/`.
    *   Place high-level, business-logic components in `src/components/`.
    *   Page-specific components should reside alongside the page file (e.g., in `src/app/dashboard/`).

2.  **Server Actions:**
    *   Define ALL server-side mutations in `src/lib/actions.ts`.
    *   Use the `"use server"` directive at the top of the file.
    *   Always get user context at the start of an action to validate permissions based on role.
    *   Return typed responses for client-side error handling (e.g., `useToast`).

3.  **Type Safety:**
    *   Define all shared types in `src/types/types.ts`.
    *   Use `zod` for runtime validation of form data on the client side (`react-hook-form`).
    *   Avoid `any` types.

4.  **Styling:**
    *   Use Tailwind utility classes directly in JSX.
    *   Use `clsx` or the provided `cn` utility to conditionally merge Tailwind classes.
    *   Avoid inline styles except for dynamic values that cannot be handled by Tailwind.

5.  **State Management:**
    *   Client-only custom hooks live in `src/hooks/`.
    *   Use `useCallback` and `useMemo` to optimize performance where necessary.
    *   Use React Hook Form (`useForm`) for all forms.

---

## Common Tasks for AI Agents

### Adding a New Feature
1.  Define or update types in `src/types/types.ts`.
2.  If it involves data mutation, add or update a server action in `src/lib/actions.ts`.
3.  Create new UI components in `src/components/` (if complex) or compose existing ones from `src/components/ui/`.
4.  Add the new feature to the appropriate main view (`EntityView`, `HousingView`, etc.).
5.  Update `MainLayoutContext` if the new action needs to be globally accessible.
6.  Run `npm run lint:fix` and `npm run build` to validate.

### Fixing Lint Errors
- Run `npm run lint:fix` to auto-correct what's possible.
- For `any` type errors, inspect the function signature and add proper types.
- For unused imports, remove the import line.
- For React Hook dependency warnings, add the missing dependency or use `// eslint-disable-next-line` if intentional and justified.

### Running Tests / Type Checking
- No Jest/Vitest tests are configured. Static analysis is the primary quality gate.
- Full type check: `npm run typecheck` (or `npx tsc --noEmit`).

---

## AI Agent Operating Rules

1.  **Always validate before committing:**
    *   Run `npm run build` (must succeed with no errors).
    *   Run `npm run lint` (strive to reduce errors and warnings).
2.  **Respect the Architecture:**
    *   Do not bypass `MainLayoutContext` to fetch data.
    *   Keep server logic in `src/lib/actions.ts`.
    *   Reuse UI components from `src/components/ui/`.
3.  **Type Safety First:**
    *   Use TypeScript strictly. Avoid `any`.
    *   Define types in `src/types/types.ts` before writing functions that use them.
4.  **Be Explicit:**
    *   When making changes, clearly state which files are being modified and provide a brief summary of the change in the `<description>` tag of the XML output.

---
**Last Updated:** 2024-11-10 (after architecture refactoring to RBAC and MainLayoutContext)
