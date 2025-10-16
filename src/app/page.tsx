
"use client";

import React, { useState, useEffect } from 'react';
import { LoginView } from "@/components/login-view";
import { getSettings } from "@/lib/actions";
import type { Coordinator, Settings } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const appSettings = await getSettings();
                setSettings(appSettings);
            } catch (err: any) {
                toast({
                    variant: "destructive",
                    title: "Błąd krytyczny",
                    description: `Nie udało się pobrać ustawień aplikacji. ${err.message}`
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [toast]);

    const handleLogin = async (user: {name: string}, password?: string) => {
        if (!settings) {
            setLoginError("Ustawienia aplikacji jeszcze nie załadowane. Spróbuj ponownie za chwilę.");
            return;
        }

        try {
            const coordinators = settings.coordinators;

            const adminLogin = process.env.NEXT_PUBLIC_ADMIN_LOGIN || 'admin';
            const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'password';
            const lowerCaseName = user.name.toLowerCase();

            if (lowerCaseName === adminLogin.toLowerCase()) {
                if (password === adminPassword) {
                     const adminUser = {
                        uid: 'admin-super-user',
                        name: 'Admin',
                        isAdmin: true,
                        password: ''
                    };
                    sessionStorage.setItem('currentUser', JSON.stringify(adminUser));
                    router.push('/dashboard');
                } else {
                     setLoginError("Nieprawidłowe hasło administratora.");
                }
                return;
            }

            if (coordinators.length === 0) {
                setLoginError("Lista koordynatorów jest pusta lub nie załadowała się. Spróbuj ponownie.");
                return;
            }

            const coordinator = coordinators.find(c => c.name.toLowerCase() === lowerCaseName);

            if (!coordinator) {
                setLoginError("Brak dostępu. Sprawdź, czy Twoje imię i nazwisko są poprawne.");
                return;
            }
            
             if (!password) {
                setLoginError("Hasło jest wymagane.");
                return;
            }

            if (coordinator.password === password) {
                sessionStorage.setItem('currentUser', JSON.stringify(coordinator));
                router.push('/dashboard');
            } else {
                setLoginError("Nieprawidłowe hasło.");
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Błąd logowania",
                description: `Wystąpił nieoczekiwany błąd. ${err.message}`
            });
             setLoginError("Błąd serwera. Spróbuj ponownie później.");
        }
    };
    
    return (
      <div className="relative h-screen w-full">
        <LoginView onLogin={handleLogin} isLoading={isLoading} loginError={loginError} setLoginError={setLoginError} />
      </div>
    );
}
