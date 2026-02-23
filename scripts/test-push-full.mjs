/**
 * Skrypt: pobiera tokeny FCM koordynatorów z Google Sheets i testuje wysyłkę PUSH
 * Uruchom: node scripts/test-push-full.mjs
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Wczytaj .env.local
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    envVars[key] = val;
}

const serviceAccountEmail = envVars['GOOGLE_SERVICE_ACCOUNT_EMAIL'];
const privateKey = envVars['GOOGLE_PRIVATE_KEY'].replace(/\\n/g, '\n');

console.log('\n=== Test PUSH Powiadomień (pełny) ===\n');

// 1. Inicjalizuj Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: 'studio-6821761262-fdf39',
            clientEmail: serviceAccountEmail,
            privateKey,
        }),
    });
}
const messaging = admin.messaging();
console.log('✅ Firebase Admin + Messaging gotowy\n');

// 2. Połącz z Google Sheets
console.log('Łączenie z Google Sheets...');
const SPREADSHEET_ID = '1Fh1Mq3JJCzXiEYjJRGMxWGHIBFMjmSLJPqRpXBIBGc'; // z sheets.ts

// Pobierz spreadsheet ID z pliku sheets.ts
let spreadsheetId = SPREADSHEET_ID;
try {
    const sheetsContent = readFileSync(resolve(__dirname, '../src/lib/sheets.ts'), 'utf-8');
    const match = sheetsContent.match(/SPREADSHEET_ID\s*=\s*['"]([^'"]+)['"]/);
    if (match) {
        spreadsheetId = match[1];
        console.log('   Spreadsheet ID z sheets.ts:', spreadsheetId);
    }
} catch (e) {
    console.log('   Używam domyślnego Spreadsheet ID');
}

const auth = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(spreadsheetId, auth);
await doc.loadInfo();
console.log('✅ Połączono z Google Sheets:', doc.title, '\n');

// 3. Pobierz koordynatorów i ich tokeny
const coordinatorsSheet = doc.sheetsByTitle['Coordinators'];
if (!coordinatorsSheet) {
    console.error('❌ Nie znaleziono arkusza "Koordynatorzy"');
    process.exit(1);
}

const rows = await coordinatorsSheet.getRows();
console.log('Koordynatorzy i ich tokeny FCM:');
console.log('─'.repeat(70));

const coordinatorsWithTokens = [];
for (const row of rows) {
    const name = row.get('name') || '(brak nazwy)';
    const uid = row.get('uid') || '(brak uid)';
    const token = row.get('pushSubscription') || '';

    if (token && token.length > 10) {
        console.log(`✅ ${name} (${uid.slice(0, 8)}...): token ${token.slice(0, 30)}...`);
        coordinatorsWithTokens.push({ name, uid, token });
    } else {
        console.log(`❌ ${name} (${uid.slice(0, 8)}...): BRAK TOKENU`);
    }
}

console.log('─'.repeat(70));
console.log(`\nKoordynatorów z tokenem: ${coordinatorsWithTokens.length} / ${rows.length}\n`);

if (coordinatorsWithTokens.length === 0) {
    console.log('⚠️  Żaden koordynator nie ma zapisanego tokenu FCM.');
    console.log('   Aby włączyć powiadomienia, zaloguj się do aplikacji i kliknij ikonę dzwonka (🔔) w nagłówku.');
    process.exit(0);
}

// 4. Wyślij testowe powiadomienie do pierwszego koordynatora z tokenem
const target = coordinatorsWithTokens[0];
console.log(`Wysyłam testowe powiadomienie do: ${target.name}...`);

try {
    const result = await messaging.send({
        token: target.token,
        notification: {
            title: '🔔 Test PUSH SmartHouse',
            body: `Testowe powiadomienie dla ${target.name}. System działa!`,
        },
        data: {
            title: '🔔 Test PUSH SmartHouse',
            body: `Testowe powiadomienie dla ${target.name}.`,
            url: '/dashboard',
            icon: '/icon-192x192.png',
        },
        webpush: {
            headers: { Urgency: 'high', TTL: '86400' },
            notification: { icon: '/icon-192x192.png', badge: '/icon-192x192.png' },
            fcmOptions: { link: '/dashboard' }
        }
    });
    console.log(`✅ SUKCES! Powiadomienie wysłane do ${target.name}`);
    console.log('   Message ID:', result);
} catch (e) {
    console.error(`❌ BŁĄD wysyłki do ${target.name}:`, e.code, '-', e.message);
    if (e.code === 'messaging/registration-token-not-registered') {
        console.log('   ℹ️  Token wygasł. Użytkownik musi ponownie włączyć powiadomienia w aplikacji.');
    }
}

console.log('\n=== Koniec testu ===\n');
