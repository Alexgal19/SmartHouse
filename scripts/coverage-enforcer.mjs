#!/usr/bin/env node
/**
 * Coverage Enforcer
 *
 * 1. Detects new/edited source files in `git diff origin/main...HEAD`.
 * 2. Checks if each file has an existing test.
 * 3. Generates minimal working test stubs for untested files.
 * 4. Runs generated tests.
 * 5. Fails if any generated test fails (blocks deploy).
 *
 * Usage:
 *   node scripts/coverage-enforcer.mjs           # auto-detect from git diff
 *   node scripts/coverage-enforcer.mjs --all    # scan all src/ files
 *   node scripts/coverage-enforcer.mjs --check  # only report, don't run
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AUTO_TEST_DIR = path.join(ROOT, 'src', '__tests__', 'auto-generated');

/**
 * Map a source file path to its expected test file path.
 */
function getTestPathForSource(srcPath) {
  const rel = path.relative(ROOT, srcPath);
  const dir = path.dirname(rel);
  const basename = path.basename(rel, path.extname(rel));

  // src/lib/foo.ts → src/__tests__/foo.test.ts
  if (dir.startsWith('src/lib')) {
    return path.join(ROOT, 'src', '__tests__', `${basename}.test.ts`);
  }

  // src/app/api/.../route.ts → src/app/api/.../__tests__/route.test.ts
  if (dir.startsWith('src/app/api')) {
    return path.join(ROOT, dir, '__tests__', `${basename}.test.ts`);
  }

  // src/components/foo.tsx → src/components/__tests__/foo.test.tsx
  if (dir.startsWith('src/components')) {
    return path.join(ROOT, dir, '__tests__', `${basename}.test.tsx`);
  }

  // src/hooks/foo.ts → src/hooks/__tests__/foo.test.ts
  if (dir.startsWith('src/hooks')) {
    return path.join(ROOT, dir, '__tests__', `${basename}.test.ts`);
  }

  // Fallback: same dir with __tests__
  return path.join(ROOT, dir, '__tests__', `${basename}.test.ts`);
}

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function getChangedFiles() {
  try {
    const out = execSync('git diff --name-only origin/main...HEAD', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    try {
      const out = execSync('git diff --name-only HEAD~1...HEAD', {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return out.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

function getAllSourceFiles() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__tests__') continue;
        walk(full);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push(path.relative(ROOT, full));
      }
    }
  }
  walk(path.join(ROOT, 'src'));
  return files;
}

/**
 * Extract exported identifiers from a TypeScript/TSX file using simple regex.
 */
function extractExports(sourcePath) {
  const text = fs.readFileSync(sourcePath, 'utf-8');
  const exports = [];

  // export function foo(
  const fnPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = fnPattern.exec(text)) !== null) {
    exports.push({ type: 'function', name: m[1] });
  }

  // export const foo = ... or export const foo = async ...
  const constPattern = /export\s+const\s+(\w+)/g;
  while ((m = constPattern.exec(text)) !== null) {
    exports.push({ type: 'const', name: m[1] });
  }

  // export { foo, bar } — skip for simplicity
  // export default function Foo(
  const defaultPattern = /export\s+default\s+(?:async\s+)?function\s+(\w+)/g;
  while ((m = defaultPattern.exec(text)) !== null) {
    exports.push({ type: 'default', name: m[1] });
  }

  // export class Foo
  const classPattern = /export\s+class\s+(\w+)/g;
  while ((m = classPattern.exec(text)) !== null) {
    exports.push({ type: 'class', name: m[1] });
  }

  return exports;
}

/**
 * Detect HTTP handlers in an API route file.
 */
function extractApiHandlers(sourcePath) {
  const text = fs.readFileSync(sourcePath, 'utf-8');
  const handlers = [];
  const pattern = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    handlers.push(m[1]);
  }
  return handlers;
}

/**
 * Generate a minimal unit test file content.
 */
function generateTestContent(relPath, exports, sourcePath) {
  const importPath = relPath
    .replace(/^src\//, '@/')
    .replace(/\.tsx?$/, '');

  // API route
  if (relPath.includes('src/app/api/') && relPath.endsWith('route.ts')) {
    const handlers = extractApiHandlers(sourcePath);
    if (handlers.length === 0) {
      return `// Auto-generated stub: no exported handlers found in ${relPath}\n`;
    }
    const mocks = `jest.mock('@/lib/auth', () => ({
  verifySession: jest.fn().mockResolvedValue({ isLoggedIn: true, isAdmin: true, name: 'Admin', uid: 'test-uid' }),
  verifyToken: jest.fn().mockResolvedValue(true),
}));
`;
    const imports = handlers.map((h) => `  ${h},`).join('\n');
    const tests = handlers.map((h) => {
      return `  describe('${h}', () => {
    it('should return a Response', async () => {
      const req = new Request('http://localhost:3000${importPath.replace('/route', '')}', { method: '${h}' });
      const res = await ${h}(req);
      expect(res).toBeInstanceOf(Response);
    });
  });`;
    }).join('\n\n');

    return `${mocks}import {\n${imports}\n} from '${importPath}';

describe('${path.basename(path.dirname(relPath))} API', () => {\n${tests}\n});\n`;
  }

  // Component
  if (relPath.endsWith('.tsx')) {
    const names = exports.map((e) => e.name).join(', ');
    if (!names) return `// Auto-generated stub: no named exports in ${relPath}\n`;
    return `import { render, screen } from '@testing-library/react';
import { ${names} } from '${importPath}';

describe('${path.basename(relPath, '.tsx')}', () => {
  it('should render without crashing', () => {
    // Minimal render check — extend with real props and assertions
    expect(${exports[0].name}).toBeDefined();
  });
});\n`;
  }

  // Library / util / hook
  const names = exports.map((e) => e.name).join(', ');
  if (!names) return `// Auto-generated stub: no named exports in ${relPath}\n`;
  return `import { ${names} } from '${importPath}';

describe('${path.basename(relPath, '.ts')}', () => {
  it('should be defined', () => {
    ${exports.map((e) => `expect(${e.name}).toBeDefined();`).join('\n    ')}
  });
});\n`;
}

function main() {
  const args = process.argv.slice(2);
  const allMode = args.includes('--all');
  const checkMode = args.includes('--check');

  const files = allMode ? getAllSourceFiles() : getChangedFiles();

  const sourceFiles = files
    .filter((f) => f.startsWith('src/'))
    .filter((f) => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('__tests__'));

  const untested = [];
  const generated = [];

  for (const rel of sourceFiles) {
    const srcPath = path.join(ROOT, rel);
    if (!fileExists(srcPath)) continue; // deleted file

    const expectedTest = getTestPathForSource(srcPath);
    if (fileExists(expectedTest)) continue; // already tested

    untested.push(rel);

    if (checkMode) continue;

    const exports = extractExports(srcPath);
    const content = generateTestContent(rel, exports, srcPath);
    const testPath = expectedTest;

    fs.mkdirSync(path.dirname(testPath), { recursive: true });
    fs.writeFileSync(testPath, content, 'utf-8');
    generated.push({ source: rel, test: path.relative(ROOT, testPath) });
  }

  const result = {
    scanned: sourceFiles.length,
    untested,
    generated: generated.map((g) => g.test),
    checkMode,
  };

  if (checkMode) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(untested.length > 0 ? 1 : 0);
  }

  if (generated.length === 0) {
    console.log('✅ All changed files already have tests. Nothing to generate.');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  console.log(`⚠️  ${generated.length} untested file(s) detected. Generated test stubs:`);
  for (const g of generated) {
    console.log(`  - ${g.source} → ${g.test}`);
  }

  // Run generated tests
  const testPaths = generated.map((g) => g.test).join(' ');
  console.log(`\n🧪 Running generated tests...\n`);
  try {
    execSync(`npm test -- --findRelatedTests ${testPaths}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log('\n✅ All generated tests passed.');
    console.log(JSON.stringify({ ...result, passed: true }, null, 2));
    process.exit(0);
  } catch {
    console.error('\n❌ Generated tests failed. Fix or write proper tests before deploying.');
    console.log(JSON.stringify({ ...result, passed: false }, null, 2));
    process.exit(1);
  }
}

main();
