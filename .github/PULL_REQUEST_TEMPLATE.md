# Pull Request

## Description

Brief summary of what this PR does and why. Reference related issues if applicable.

**Type of change:**
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Documentation update

---

## Files Changed

List the main files modified by this PR:

- `src/components/...`
- `src/lib/...`
- etc.

---

## Changes Made

Describe the key changes:
- What functionality was added, fixed, or improved?
- Any breaking changes or architectural decisions?

---

## How to Test Locally

Steps to verify this PR works:

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Test scenario: [describe what to test]
4. Expected result: [describe expected outcome]

---

## Checklist

- [ ] **Code Quality**
  - [ ] Ran `npm run lint:fix` to auto-fix issues
  - [ ] Ran `npm run lint` (zero or minimal known errors)
  - [ ] Ran `npm run build` (build passes with no errors)
  - [ ] TypeScript types are correct (no `any` unless justified)
  - [ ] No console.log statements (except for debugging, removed before commit)

- [ ] **Architecture & Conventions**
  - [ ] UI components placed in `src/components/ui/` (primitives) or `src/components/` (business logic)
  - [ ] Server logic in `src/lib/` and `src/lib/actions.ts`
  - [ ] No client-only code in server-only modules
  - [ ] No hardcoded secrets or credentials
  - [ ] `.env.local` is NOT committed

- [ ] **Imports & Dependencies**
  - [ ] Used absolute imports (aliases like `@/`) where possible
  - [ ] No missing imports or unresolved modules
  - [ ] No unnecessary dependencies added

- [ ] **Testing & Verification**
  - [ ] Tested locally in dev mode
  - [ ] Verified form inputs/validations work (if applicable)
  - [ ] Checked Sheets integration (if modified)
  - [ ] No console errors or warnings

- [ ] **Documentation**
  - [ ] Updated `.github/copilot-instructions.md` if adding new conventions or integration points
  - [ ] Added JSDoc comments to public functions/actions
  - [ ] Updated README.md if adding new setup steps or features

- [ ] **A11y & Styling**
  - [ ] Tailwind CSS used (no inline styles)
  - [ ] Keyboard navigation works (if applicable)
  - [ ] ARIA labels correct (if applicable)
  - [ ] No console warnings about missing alt text or semantic HTML

---

## Related Issues

Closes #[issue-number]

---

## Reviewer Notes

Any special instructions for reviewers or known limitations:
