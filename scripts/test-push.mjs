/**
 * Skrypt diagnostyczny do testowania FCM Push Notifications
 * Uruchom: node scripts/test-push.mjs
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Wczytaj .env.local
const envPath = resolve(__dirname, '../.env.local');
let envContent = '';
try {
    envContent = readFileSync(envPath, 'utf-8');
} catch (e) {
    console.error('❌ Nie można wczytać .env.local:', e.message);
    process.exit(1);
}

// Parsuj zmienne środowiskowe
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
const privateKeyRaw = envVars['GOOGLE_PRIVATE_KEY'];

console.log('\n=== Diagnoza PUSH Powiadomień ===\n');

// 1. Sprawdź zmienne środowiskowe
console.log('1. Zmienne środowiskowe:');
console.log('   GOOGLE_SERVICE_ACCOUNT_EMAIL:', serviceAccountEmail ? `✅ ${serviceAccountEmail}` : '❌ BRAK');
console.log('   GOOGLE_PRIVATE_KEY:', privateKeyRaw ? '✅ Ustawiony' : '❌ BRAK');
console.log('   NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY:', envVars['NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY'] ? '✅ Ustawiony' : '❌ BRAK');

if (!serviceAccountEmail || !privateKeyRaw) {
    console.error('\n❌ Brak wymaganych zmiennych środowiskowych. Sprawdź .env.local');
    process.exit(1);
}

const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

// 2. Inicjalizuj Firebase Admin
console.log('\n2. Inicjalizacja Firebase Admin...');
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: 'studio-6821761262-fdf39',
                clientEmail: serviceAccountEmail,
                privateKey: privateKey,
            }),
        });
    }
    console.log('   ✅ Firebase Admin zainicjalizowany');
} catch (e) {
    console.error('   ❌ Błąd inicjalizacji Firebase Admin:', e.message);
    process.exit(1);
}

// 3. Sprawdź Messaging
console.log('\n3. Firebase Messaging:');
let messaging;
try {
    messaging = admin.messaging();
    console.log('   ✅ Messaging dostępny');
} catch (e) {
    console.error('   ❌ Błąd Messaging:', e.message);
    process.exit(1);
}

// 4. Wczytaj Google Sheets i sprawdź tokeny koordynatorów
console.log('\n4. Sprawdzanie tokenów FCM koordynatorów w Google Sheets...');
console.log('   (Uruchom aplikację i sprawdź w Settings -> Coordinators czy pushSubscription jest zapisany)');
console.log('   Możesz też sprawdzić bezpośrednio w Google Sheets w arkuszu "Koordynatorzy"');

// 5. Test wysyłki z przykładowym tokenem (jeśli podany jako argument)
const testToken = process.argv[2];
if (testToken) {
    console.log('\n5. Test wysyłki FCM do tokenu:', testToken.slice(0, 20) + '...');
    try {
        const result = await messaging.send({
            token: testToken,
            notification: {
                title: '🔔 Test PUSH SmartHouse',
                body: 'To jest testowe powiadomienie PUSH. Jeśli widzisz to, system działa!',
            },
            data: {
                title: '🔔 Test PUSH SmartHouse',
                body: 'To jest testowe powiadomienie PUSH.',
                url: '/dashboard',
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: {
                    icon: '/icon-192x192.png',
                },
                fcmOptions: { link: '/dashboard' }
            }
        });
        console.log('   ✅ Powiadomienie wysłane! Message ID:', result);
    } catch (e) {
        console.error('   ❌ Błąd wysyłki:', e.code, '-', e.message);
        if (e.code === 'messaging/registration-token-not-registered') {
            console.log('   ℹ️  Token wygasł lub jest nieprawidłowy. Użytkownik musi ponownie włączyć powiadomienia.');
        }
        if (e.code === 'messaging/invalid-registration-token') {
            console.log('   ℹ️  Nieprawidłowy format tokenu.');
        }
    }
} else {
    console.log('\n5. Aby przetestować wysyłkę do konkretnego tokenu, uruchom:');
    console.log('   node scripts/test-push.mjs <FCM_TOKEN>');
    console.log('\n   Token FCM znajdziesz w Google Sheets -> arkusz "Koordynatorzy" -> kolumna "pushSubscription"');
    console.log('   lub w aplikacji: Settings -> Koordynatorzy -> pushSubscription');
}

console.log('\n=== Koniec diagnozy ===\n');
