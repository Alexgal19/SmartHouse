
"use server";

import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from '@/types';
import { getSettings } from '@/lib/sheets';
import { redirect } from 'next/navigation';
import { sessionOptions } from '@/lib/session';

export async function getSession(): Promise<IronSession<SessionData>> {
     const session = await getIronSession<SessionData>(cookies(), sessionOptions);

     if (!session.isLoggedIn) {
        session.isLoggedIn = false;
        session.uid = '';
        session.name = '';
        session.isAdmin = false;
     }

     return session;
}


export async function login(name: string, password_input: string) {
  // Hardcoded admin check
  if (name.toLowerCase() === 'admin' && password_input === process.env.ADMIN_PASSWORD) {
    const session = await getSession();
    session.isLoggedIn = true;
    session.uid = 'admin-hardcoded';
    session.name = 'Admin';
    session.isAdmin = true;
    await session.save();
    return { success: true, user: { uid: 'admin-hardcoded', name: 'Admin', isAdmin: true } };
  }

  const settings = await getSettings();
  const user = settings.coordinators.find(c => c.name.toLowerCase() === name.toLowerCase() && c.password === password_input);

  if (user) {
    const session = await getSession();
    session.isLoggedIn = true;
    session.uid = user.uid;
    session.name = user.name;
    session.isAdmin = user.isAdmin;
    await session.save();
    return { success: true, user: { uid: user.uid, name: user.name, isAdmin: user.isAdmin } };
  }
  
  throw new Error("Nieprawidłowa nazwa użytkownika lub hasło.");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/');
}
