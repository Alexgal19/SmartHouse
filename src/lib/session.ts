
"use server";

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SessionData } from '@/types';
import { getSettings } from './actions';

if (!process.env.SECRET_COOKIE_PASSWORD) {
    console.warn("SECRET_COOKIE_PASSWORD is not set. Using a default value. This is not secure for production.");
}

const sessionOptions = {
    password: process.env.SECRET_COOKIE_PASSWORD || 'default_password_for_smarthouse_app_dev_only',
    cookieName: 'smarthouse-session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
    },
};

export async function getSession() {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);

    if (!session.isLoggedIn) {
        session.isLoggedIn = false;
        session.uid = '';
        session.name = '';
        session.isAdmin = false;
    }
    return session;
}

export async function login(name: string, password?: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    
    if (!password) {
        return { success: false, error: "Hasło jest wymagane." };
    }

    const {coordinators} = await getSettings();

    const adminLogin = process.env.NEXT_PUBLIC_ADMIN_LOGIN || 'admin';
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'password';
    const lowerCaseName = name.toLowerCase();

    let userToLogin: { uid: string; name: string; isAdmin: boolean; } | null = null;

    if (lowerCaseName === adminLogin.toLowerCase()) {
        if (password === adminPassword) {
            userToLogin = {
                uid: 'admin-super-user',
                name: 'Admin',
                isAdmin: true,
            };
        } else {
            return { success: false, error: "Nieprawidłowe hasło administratora." };
        }
    } else {
        const coordinator = coordinators.find(c => c.name.toLowerCase() === lowerCaseName);

        if (!coordinator) {
            return { success: false, error: "Brak dostępu. Sprawdź, czy Twoje imię i nazwisko są poprawne." };
        }
        if (coordinator.password !== password) {
            return { success: false, error: "Nieprawidłowe hasło." };
        }
        
        userToLogin = {
            uid: coordinator.uid,
            name: coordinator.name,
            isAdmin: coordinator.isAdmin,
        };
    }

    if (userToLogin) {
        session.uid = userToLogin.uid;
        session.name = userToLogin.name;
        session.isAdmin = userToLogin.isAdmin;
        session.isLoggedIn = true;
        await session.save();
        // Redirect on the server-side after successful login
        redirect('/dashboard');
    }

    // This part will only be reached if the login fails for some unknown reason.
    // The successful login case redirects and never returns.
    return { success: false, error: "Nieznany błąd logowania." };
}

export async function logout() {
    const session = await getSession();
    session.destroy();
    redirect('/');
}
