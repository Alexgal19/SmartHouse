
"use server";

import { getIronSession, type IronSession } from 'iron-session';
import { cookies, headers } from 'next/headers';
import type { SessionData } from '@/types';
import { getSettings } from '@/lib/sheets';
import { redirect } from 'next/navigation';
import { sessionOptions } from '@/lib/session';
import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase-admin';

// Rate limiter backed by Firestore — works across serverless instances
// Falls back silently if Firestore is unavailable
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function safeIpDocId(ip: string): string {
  return ip.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
}

async function checkRateLimit(ip: string): Promise<void> {
  if (!adminDb) return;
  try {
    const now = Date.now();
    const snap = await adminDb.collection('loginRateLimits').doc(safeIpDocId(ip)).get();
    const data = snap.data();
    if (data && now < data.resetAt && data.count >= MAX_ATTEMPTS) {
      throw new Error('Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za 15 minut.');
    }
  } catch (e) {
    // Rethrow only rate-limit errors; swallow Firestore infra errors gracefully
    if (e instanceof Error && e.message.includes('Zbyt wiele')) throw e;
    console.warn('[auth] checkRateLimit Firestore error (degraded gracefully):', e);
  }
}

async function recordFailedAttempt(ip: string): Promise<void> {
  if (!adminDb) return;
  try {
    const now = Date.now();
    const ref = adminDb.collection('loginRateLimits').doc(safeIpDocId(ip));
    const snap = await ref.get();
    const data = snap.data();
    if (data && now < data.resetAt) {
      await ref.update({ count: admin.firestore.FieldValue.increment(1) });
    } else {
      await ref.set({ count: 1, resetAt: now + WINDOW_MS });
    }
  } catch (e) {
    console.warn('[auth] recordFailedAttempt Firestore error (degraded gracefully):', e);
  }
}

async function clearAttempts(ip: string): Promise<void> {
  if (!adminDb) return;
  try {
    // eslint-disable-next-line no-restricted-syntax -- Firestore document delete, not Google Sheets; required for rate limit cleanup
    await adminDb.collection('loginRateLimits').doc(safeIpDocId(ip)).delete();
  } catch (e) {
    console.warn('[auth] clearAttempts Firestore error (degraded gracefully):', e);
  }
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  if (!session.isLoggedIn) {
    session.isLoggedIn = false;
    session.uid = '';
    session.name = '';
    session.isAdmin = false;
    session.isDriver = false;
    session.isRekrutacja = false;
  }

  return session;
}


export async function login(name: string, password_input: string) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  await checkRateLimit(ip);

  // Hardcoded admin check
  if (name.toLowerCase() === 'admin' && password_input === process.env.ADMIN_PASSWORD) {
    const session = await getSession();
    session.isLoggedIn = true;
    session.uid = 'admin-hardcoded';
    session.name = 'Admin';
    session.isAdmin = true;
    session.isDriver = false;
    session.isRekrutacja = false;
    await clearAttempts(ip);
    await session.save();
    return { success: true, user: { uid: 'admin-hardcoded', name: 'Admin', isAdmin: true, isDriver: false, isRekrutacja: false } };
  }

  const settings = await getSettings();
  const candidate = settings.coordinators.find(c => c.name.toLowerCase() === name.toLowerCase());

  let passwordValid = false;
  if (candidate?.password) {
    const storedPwd = candidate.password;
    if (storedPwd.startsWith('$2')) {
      // Zahashowane hasło (bcrypt)
      passwordValid = await bcrypt.compare(password_input, storedPwd);
    } else {
      // Plaintext (stary format — akceptuj, ale zaloguj ostrzeżenie)
      passwordValid = storedPwd === password_input;
      if (passwordValid) {
        console.warn(`[auth] Koordynator "${candidate.name}" używa niezahashowanego hasła. Uruchom migrację haseł.`);
      }
    }
  }

  const user = passwordValid ? candidate : undefined;

  if (user) {
    await clearAttempts(ip);
    const session = await getSession();
    session.isLoggedIn = true;
    session.uid = user.uid;
    session.name = user.name;
    session.isAdmin = user.isAdmin;
    session.isDriver = user.isDriver || false;
    session.isRekrutacja = user.isRekrutacja || false;
    await session.save();
    return { success: true, user: { uid: user.uid, name: user.name, isAdmin: user.isAdmin, isDriver: user.isDriver || false, isRekrutacja: user.isRekrutacja || false } };
  }

  await recordFailedAttempt(ip);
  throw new Error("Nieprawidłowa nazwa użytkownika lub hasło.");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/');
}
