#!/usr/bin/env node
/**
 * scripts/update-ai-context.mjs
 *
 * Automatically generates AI_CONTEXT.md — a snapshot of the project state
 * for AI coding assistants. Called by the git pre-commit hook.
 *
 * Sections generated:
 *   1. Key npm dependencies with versions
 *   2. Git status (current branch + last 5 commits)
 *   3. Project file tree (depth ≤ 4, common dirs excluded)
 *   4. Code statistics (file/line counts)
 *   5. API routes with HTTP methods
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Helpers ────────────────────────────────────────────────────────────────

function run(cmd, fallback = '') {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return fallback;
  }
}

function nowUTC() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ─── 1. Key Dependencies ─────────────────────────────────────────────────────

const KEY_PACKAGES = [
  'next',
  'react',
  'react-dom',
  'typescript',
  'firebase',
  'firebase-admin',
  'googleapis',
  'google-spreadsheet',
  'google-auth-library',
  '@google-cloud/firestore',
  'tailwindcss',
  'framer-motion',
  '@tanstack/react-query',
  'zod',
  'react-hook-form',
  'iron-session',
  'sonner',
  'lucide-react',
  'recharts',
  'winston',
];

function getDependencies() {
  const pkgPath = resolve(ROOT, 'package.json');
  if (!existsSync(pkgPath)) return '_(package.json not found)_';

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const all = { ...pkg.dependencies, ...pkg.devDependencies };

  const rows = KEY_PACKAGES
    .filter(name => all[name])
    .map(name => `| \`${name}\` | \`${all[name]}\` |`);

  return [
    '| Package | Version |',
    '|---------|---------|',
    ...rows,
  ].join('\n');
}

// ─── 2. Git Status ───────────────────────────────────────────────────────────

function getGitStatus() {
  const branch = run('git rev-parse --abbrev-ref HEAD', 'unknown');
  const log = run(
    'git log --oneline -5 --pretty=format:"- `%h` %s (%cr)"',
    '_(no commits yet)_'
  );
  const dirty = run('git status --short');
  const dirtySection = dirty
    ? `\n**Uncommitted changes:**\n\`\`\`\n${dirty}\n\`\`\``
    : '\n**Working tree:** clean ✓';

  return `**Branch:** \`${branch}\`

**Last 5 commits:**
${log}
${dirtySection}`;
}

// ─── 3. File Tree ────────────────────────────────────────────────────────────

const IGNORE = new Set([
  // build & tooling artifacts
  'node_modules', '.next', '.git', '.swc', '.firebase',
  'tsconfig.tsbuildinfo', 'package-lock.json', 'firebase-debug.log', '.modified',
  // test output (tracked in git but not useful for AI context)
  'playwright-report', 'test-results',
  // junk / temp files in root
  'static_analysis_semgrep_1', 'workspace',
  'check_sheet.js', 'lint-results.json', 'lint-results.txt', 'test_output.txt',
  // macOS metadata
  '.DS_Store',
  // IDE / cloud IDE config (no code value)
  '.roo', '.codesandbox', '.idx', '.devcontainer',
]);

function buildTree(dir, prefix = '', depth = 0) {
  if (depth > 3) return '';

  let entries;
  try {
    entries = readdirSync(dir)
      .filter(e => !IGNORE.has(e) && !e.endsWith('.tsbuildinfo'))
      .sort((a, b) => {
        const aDir = statSync(join(dir, a)).isDirectory();
        const bDir = statSync(join(dir, b)).isDirectory();
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a.localeCompare(b);
      });
  } catch {
    return '';
  }

  let out = '';
  entries.forEach((entry, idx) => {
    const isLast = idx === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    const fullPath = join(dir, entry);

    let isDir = false;
    try { isDir = statSync(fullPath).isDirectory(); } catch { /* skip */ }

    out += `${prefix}${connector}${entry}${isDir ? '/' : ''}\n`;
    if (isDir) {
      out += buildTree(fullPath, prefix + childPrefix, depth + 1);
    }
  });

  return out;
}

function getFileTree() {
  const tree = buildTree(ROOT);
  return `\`\`\`\nSmartHouse/\n${tree}\`\`\``;
}

// ─── 4. Code Statistics ──────────────────────────────────────────────────────

function getCodeStats() {
  const tsFileCount = run(
    `find src -type f \\( -name "*.ts" -o -name "*.tsx" \\) | grep -v "__mocks__" | wc -l`,
    '?'
  ).trim();

  const tsLineCount = run(
    `find src -type f \\( -name "*.ts" -o -name "*.tsx" \\) | grep -v "__mocks__" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'`,
    '?'
  ).trim();

  const testFileCount = run(
    `find src tests -type f \\( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \\) 2>/dev/null | wc -l`,
    '?'
  ).trim();

  const componentCount = run(
    `find src/components -type f \\( -name "*.tsx" \\) 2>/dev/null | wc -l`,
    '?'
  ).trim();

  return [
    '| Metric | Value |',
    '|--------|-------|',
    `| TypeScript / TSX files | ${tsFileCount} |`,
    `| Total lines (TS/TSX) | ${tsLineCount} |`,
    `| Test files (unit + E2E) | ${testFileCount} |`,
    `| React components | ${componentCount} |`,
  ].join('\n');
}

// ─── 5. API Routes ───────────────────────────────────────────────────────────

function getApiRoutes() {
  const routeFilesRaw = run(
    `find src/app/api -name "route.ts" 2>/dev/null`,
    ''
  );

  if (!routeFilesRaw) return '_No API routes found_';

  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const rows = [];

  for (const file of routeFilesRaw.split('\n').filter(Boolean)) {
    let content = '';
    try {
      content = readFileSync(resolve(ROOT, file), 'utf-8');
    } catch {
      continue;
    }

    const methods = HTTP_METHODS.filter(m =>
      new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(content)
    );

    const routePath = file
      .replace('src/app/api', '/api')
      .replace('/route.ts', '') || '/api';

    rows.push(`| \`${routePath}\` | ${methods.map(m => `\`${m}\``).join(', ')} |`);
  }

  if (rows.length === 0) return '_No exported HTTP handlers found_';

  return [
    '| Route | Methods |',
    '|-------|---------|',
    ...rows.sort(),
  ].join('\n');
}

// ─── Compose & Write ─────────────────────────────────────────────────────────

function generate() {
  const timestamp = nowUTC();

  const content = `# AI_CONTEXT.md — Project Snapshot

> ⚠️ **DO NOT EDIT MANUALLY.**
> Auto-generated by \`scripts/update-ai-context.mjs\` on every \`git commit\` (pre-commit hook).
> Last updated: **${timestamp}**

---

## 📦 Key Dependencies

${getDependencies()}

---

## 🔀 Git Status

${getGitStatus()}

---

## 📊 Code Statistics

${getCodeStats()}

---

## 🛣️ API Routes

${getApiRoutes()}

---

## 🗂️ Project File Tree

> Excludes: \`node_modules/\`, \`.next/\`, \`.git/\`, build artifacts, IDE configs, temp files. Max depth: 4.

${getFileTree()}

---

## 🔗 Related AI Configuration Files

| File | Purpose |
|------|---------|
| [\`CLAUDE.md\`](./CLAUDE.md) | Entry point for AI agents — quick rules & checklist |
| [\`AGENTS.md\`](./AGENTS.md) | Full agent registry — roles, protocols, conventions |
| \`AI_CONTEXT.md\` | ← You are here — live project snapshot |

---

*Generated by \`scripts/update-ai-context.mjs\` • Do not edit this file manually.*
`;

  const outPath = resolve(ROOT, 'AI_CONTEXT.md');
  writeFileSync(outPath, content, 'utf-8');
  console.log(`✅  AI_CONTEXT.md updated (${timestamp})`);
}

generate();
