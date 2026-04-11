#!/usr/bin/env node
/**
 * scripts/backup-sheets.mjs
 *
 * Eksportuje wszystkie arkusze Google Sheets do pliku XLSX i JSON.
 * Pliki zapisywane są w katalogu backups/<timestamp>/.
 *
 * Wymagane zmienne środowiskowe (.env.local):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *
 * Użycie:
 *   node scripts/backup-sheets.mjs
 *   node scripts/backup-sheets.mjs --format xlsx   (tylko XLSX)
 *   node scripts/backup-sheets.mjs --format json   (tylko JSON)
 *   node scripts/backup-sheets.mjs --format both   (domyślnie)
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
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
const formatArg = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'both';
const FORMAT = ['xlsx', 'json', 'both'].includes(formatArg) ? formatArg : 'both';

// ─── Auth ──────────────────────────────────────────────────────────────────
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    console.error('❌ Brak GOOGLE_SERVICE_ACCOUNT_EMAIL lub GOOGLE_PRIVATE_KEY w .env.local');
    process.exit(1);
  }

  return new JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = resolve(ROOT, 'backups', timestamp);

  mkdirSync(backupDir, { recursive: true });
  console.log(`📁 Katalog backupu: backups/${timestamp}/`);

  console.log('🔐 Uwierzytelnianie...');
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();

  console.log(`📊 Arkusz: "${doc.title}"`);
  console.log(`📋 Liczba zakładek: ${doc.sheetCount}\n`);

  const allData = {}; // for combined JSON

  for (const sheet of doc.sheetsByIndex) {
    process.stdout.write(`  ↳ ${sheet.title.padEnd(30)}`);

    try {
      await sheet.loadHeaderRow();
      const rows = await sheet.getRows();
      const headers = sheet.headerValues ?? [];

      const sheetData = rows.map(row =>
        headers.reduce((obj, header) => {
          obj[header] = row.get(header) ?? '';
          return obj;
        }, {})
      );

      allData[sheet.title] = sheetData;

      if (FORMAT === 'json' || FORMAT === 'both') {
        const jsonPath = resolve(backupDir, `${sanitizeFilename(sheet.title)}.json`);
        writeFileSync(jsonPath, JSON.stringify(sheetData, null, 2), 'utf-8');
      }

      process.stdout.write(`✅ ${rows.length} wierszy\n`);
    } catch (err) {
      process.stdout.write(`⚠️  Pominięto (${err.message})\n`);
    }
  }

  // Combined JSON backup
  if (FORMAT === 'json' || FORMAT === 'both') {
    const combinedPath = resolve(backupDir, '_all_sheets.json');
    writeFileSync(combinedPath, JSON.stringify({
      exportedAt: new Date().toISOString(),
      spreadsheetId: SPREADSHEET_ID,
      spreadsheetTitle: doc.title,
      sheets: allData,
    }, null, 2), 'utf-8');
    console.log(`\n💾 JSON: backups/${timestamp}/_all_sheets.json`);
  }

  // XLSX backup
  if (FORMAT === 'xlsx' || FORMAT === 'both') {
    const xlsx = await import('xlsx');
    const wb = xlsx.utils.book_new();

    for (const [sheetName, sheetData] of Object.entries(allData)) {
      if (sheetData.length === 0) continue;
      const ws = xlsx.utils.json_to_sheet(sheetData);
      // Truncate sheet name to 31 chars (Excel limit)
      xlsx.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    }

    const xlsxPath = resolve(backupDir, `backup.xlsx`);
    xlsx.writeFile(wb, xlsxPath);
    console.log(`💾 XLSX: backups/${timestamp}/backup.xlsx`);
  }

  console.log(`\n✅ Backup zakończony pomyślnie: ${new Date().toLocaleString('pl-PL')}`);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\-żźćńółśąę]/gi, '_');
}

main().catch(err => {
  console.error('❌ Błąd backupu:', err.message);
  process.exit(1);
});
