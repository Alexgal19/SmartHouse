
"use server";

import { getIronSession, type IronSession } from 'iron-session';
import { cookies, headers } from 'next/headers';
import type { SessionData } from '@/types';
import { getSettings } from '@/lib/sheets';
import { redirect } from 'next/navigation';
import { sessionOptions } from '@/lib/session';
import bcrypt from 'bcryptjs';

// Simple in-memory rate limiter: max 10 failed attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      throw new Error('Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za 15 minut.');
    }
  } else {
    loginAttempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
  }
}

function recordFailedAttempt(ip: string): void {
  const entry = loginAttempts.get(ip);
  if (entry) entry.count++;
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
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
  checkRateLimit(ip);

  // Hardcoded admin check
  if (name.toLowerCase() === 'admin' && password_input === process.env.ADMIN_PASSWORD) {
    const session = await getSession();
    session.isLoggedIn = true;
    session.uid = 'admin-hardcoded';
    session.name = 'Admin';
    session.isAdmin = true;
    session.isDriver = false;
    session.isRekrutacja = false;
    clearAttempts(ip);
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
    clearAttempts(ip);
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

  recordFailedAttempt(ip);
  throw new Error("Nieprawidłowa nazwa użytkownika lub hasło.");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/');
}
