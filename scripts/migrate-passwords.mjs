/**
 * Skrypt migracji haseł koordynatorów do bcrypt.
 * Uruchom RAZ: node scripts/migrate-passwords.mjs
 *
 * Zmienia wszystkie plaintext hasła w arkuszu Coordinators na bcrypt hash.
 * Hasła już zahashowane ($2...) są pomijane.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
const BCRYPT_ROUNDS = 12;

async function main() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !key) {
        console.error('Brak GOOGLE_SERVICE_ACCOUNT_EMAIL lub GOOGLE_PRIVATE_KEY w .env.local');
        process.exit(1);
    }

    const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Coordinators'];
    if (!sheet) {
        console.error('Nie znaleziono arkusza Coordinators');
        process.exit(1);
    }

    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();

    let migrated = 0;
    let skipped = 0;

    for (const row of rows) {
        const name = row.get('name');
        const pwd = row.get('password');

        if (!pwd) {
            console.log(`  [SKIP] ${name} — brak hasła`);
            skipped++;
            continue;
        }

        if (pwd.startsWith('$2')) {
            console.log(`  [OK]   ${name} — już zahashowane`);
            skipped++;
            continue;
        }

        console.log(`  [HASH] ${name} — hashowanie...`);
        const hashed = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
        row.set('password', hashed);
        await row.save();
        migrated++;
        console.log(`         → gotowe`);
    }

    console.log(`\nMigracja zakończona: ${migrated} zahashowanych, ${skipped} pominiętych.`);
    console.log('WAŻNE: Usuń stare plaintext backupy haseł jeśli istnieją.');
}

main().catch(err => {
    console.error('Błąd migracji:', err);
    process.exit(1);
});
