#!/usr/bin/env node
/**
 * scripts/remove-bok-residents-sheet.mjs
 *
 * Usuwa arkusz "BokResidents" z Google Sheets jeśli istnieje.
 * Aplikacja SmartHouse używa teraz arkusza "BOK" — stary arkusz jest zbędny.
 *
 * Wymagane zmienne środowiskowe (.env.local):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Load env ──────────────────────────────────────────────────────────────
const envPath = resolve(ROOT, '.env.local');
if (existsSync(envPath)) {
  const { readFileSync } = await import('fs');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

// ─── Config ────────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';

// ─── Auth ──────────────────────────────────────────────────────────────────
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) {
    console.error('Brak GOOGLE_SERVICE_ACCOUNT_EMAIL lub GOOGLE_PRIVATE_KEY w .env.local');
    process.exit(1);
  }
  return new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();

  console.log(`Podłączono do: ${doc.title}`);

  const oldSheet = doc.sheetsByTitle['BokResidents'];

  if (!oldSheet) {
    console.log('Arkusz "BokResidents" nie istnieje — nie ma czego usuwać.');
    return;
  }

  console.log('Znaleziono arkusz "BokResidents". Usuwam...');
  await oldSheet.delete();
  console.log('Arkusz "BokResidents" został usunięty.');
}

main().catch((err) => {
  console.error('Błąd:', err);
  process.exit(1);
});
