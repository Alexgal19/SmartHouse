#!/usr/bin/env node
/**
 * Test Impact Analysis
 *
 * Maps changed source files to related Playwright/Jest test files.
 * Usage:
 *   node scripts/test-impact.mjs              # uses origin/main...HEAD
 *   node scripts/test-impact.mjs --all        # return all tests
 *   node scripts/test-impact.mjs <file1> ...  # explicit files
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RULES_PATH = path.join(__dirname, 'test-impact-rules.json');

/**
 * Convert a glob-like pattern to a RegExp.
 * Supports: ** (any depth), * (any chars except /), ? (single char)
 */
function globToRegex(pattern) {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern.slice(i, i + 2) === '**') {
      regex += '.*';
      i += 2;
    } else if (pattern[i] === '*') {
      regex += '[^/]*';
      i += 1;
    } else if (pattern[i] === '?') {
      regex += '.';
      i += 1;
    } else {
      regex += escapeRegex(pattern[i]);
      i += 1;
    }
  }
  return new RegExp(`^${regex}$`);
}

function escapeRegex(ch) {
  const specials = /[\\^$+.()|[\]{}]/;
  return specials.test(ch) ? '\\' + ch : ch;
}

function loadRules() {
  if (!fs.existsSync(RULES_PATH)) {
    console.warn(`⚠️  Rules file not found: ${RULES_PATH}`);
    return [];
  }
  const raw = fs.readFileSync(RULES_PATH, 'utf-8');
  return JSON.parse(raw).rules || [];
}

function getChangedFiles(base = 'origin/main') {
  try {
    const output = execSync(`git diff --name-only ${base}...HEAD`, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // If origin/main doesn't exist, fallback to HEAD~1
    try {
      const output = execSync('git diff --name-only HEAD~1...HEAD', {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

function getAllSpecFiles() {
  const testsDir = path.join(ROOT, 'tests');
  if (!fs.existsSync(testsDir)) return [];
  return fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith('.spec.ts'))
    .map((f) => `tests/${f}`);
}

function matchFile(file, pattern) {
  const regex = globToRegex(pattern);
  return regex.test(file);
}

function main() {
  const args = process.argv.slice(2);
  const allMode = args.includes('--all');
  const explicitFiles = args.filter((a) => !a.startsWith('--'));

  if (allMode) {
    const all = getAllSpecFiles();
    console.log(JSON.stringify({ tests: all, changed: [], triggeredBy: 'all' }));
    process.exit(0);
  }

  const changedFiles = explicitFiles.length > 0 ? explicitFiles : getChangedFiles();
  const rules = loadRules();
  const tests = new Set();
  let allTestsTriggered = false;

  for (const file of changedFiles) {
    for (const rule of rules) {
      if (matchFile(file, rule.pattern)) {
        if (rule.tests.includes('*')) {
          allTestsTriggered = true;
        } else {
          rule.tests.forEach((t) => tests.add(t));
        }
      }
    }
  }

  const resultTests = allTestsTriggered ? getAllSpecFiles() : Array.from(tests);

  const out = {
    tests: resultTests,
    changed: changedFiles,
    triggeredBy: allTestsTriggered ? 'wildcard-rule' : 'rules',
  };

  console.log(JSON.stringify(out));
}

main();
