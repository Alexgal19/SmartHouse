#!/usr/bin/env node
/**
 * scripts/clear-old-bok-sheet.mjs
 *
 * Tworzy nowy arkusz BOK w Google Sheets z poprawnymi nagłówkami.
 * Opcjonalnie czyści wiersze ze starego arkusza BokResidents.
 *
 * Wymagane zmienne środowiskowe (.env.local):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *
 * Użycie:
 *   node scripts/clear-old-bok-sheet.mjs
 *   node scripts/clear-old-bok-sheet.mjs --delete-old   (wyczyść też stare wiersze)
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

const args = process.argv.slice(2);
const DELETE_OLD = args.includes('--delete-old');

const BOK_HEADERS = [
  'id', 'role', 'firstName', 'lastName', 'fullName', 'coordinatorId', 'nationality', 'address', 'roomNumber',
  'zaklad', 'gender', 'passportNumber', 'checkInDate', 'checkOutDate', 'returnStatus', 'status', 'comments', 'sendDate', 'sendTime', 'sendReason', 'dismissDate', 'sourceOdbiorId'
];

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

  const title = doc.title;
  console.log(`Podłączono do: ${title}`);

  // 1. Sprawdź czy nowy arkusz BOK już istnieje
  if (doc.sheetsByTitle['BOK']) {
    console.error('Arkusz "BOK" już istnieje. Przerywam, żeby nie nadpisać danych.');
    process.exit(1);
  }

  // 2. Stwórz nowy arkusz BOK z nagłówkami
  const newSheet = await doc.addSheet({ title: 'BOK', headerValues: BOK_HEADERS });
  console.log(`Utworzono nowy arkusz "BOK" z ${BOK_HEADERS.length} kolumnami.`);

  // 3. Opcjonalnie: wyczyść stare wiersze z BokResidents
  if (DELETE_OLD) {
    const oldSheet = doc.sheetsByTitle['BokResidents'];
    if (oldSheet) {
      const rows = await oldSheet.getRows();
      if (rows.length > 0) {
        console.log(`Czyszczę ${rows.length} wierszy ze starego arkusza "BokResidents"...`);
        for (const row of rows) {
          await row.delete();
        }
        console.log('Stare wiersze usunięte.');
      } else {
        console.log('Stary arkusz "BokResidents" jest już pusty.');
      }
    } else {
      console.log('Nie znaleziono starego arkusza "BokResidents".');
    }
  } else {
    console.log('Pominięto czyszczenie starego arkusza. Użyj --delete-old jeśli chcesz usunąć stare wiersze.');
  }

  console.log('\nGotowe! Nowy arkusz "BOK" jest gotowy do użycia.');
}

main().catch((err) => {
  console.error('Błąd:', err);
  process.exit(1);
});
