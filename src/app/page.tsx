
"use client";

import { LoginView } from "@/components/login-view";
import { useState, useEffect } from "react";
import { getSettings } from "@/lib/actions";
import type { Coordinator } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";


export default function LoginPage() {
    const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const loggedInUser = sessionStorage.getItem('currentUser');
        if (loggedInUser) {
            router.push('/dashboard');
        } else {
             getSettings()
                .then(settings => setCoordinators(settings.coordinators))
                .catch(err => {
                    toast({
                        variant: "destructive",
                        title: "Błąd ładowania",
                        description: `Nie udało się pobrać listy koordynatorów. ${err.message}`
                    })
                })
                .finally(() => setIsLoading(false));
        }
    }, [router, toast]);
    
    const handleLogin = async (user: {name: string}, password?: string) => {
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
                 (window as any).setLoginError('Nieprawidłowe hasło administratora.');
            }
            return;
        }

        const coordinator = coordinators.find(c => c.name.toLowerCase() === lowerCaseName);

        if (!coordinator) {
            (window as any).setLoginError('Brak dostępu. Sprawdź, czy Twoje imię i nazwisko są poprawne.');
            return;
        }
        
         if (!password) {
            (window as any).setLoginError('Hasło jest wymagane.');
            return;
        }

        if (coordinator.password === password) {
            sessionStorage.setItem('currentUser', JSON.stringify(coordinator));
            router.push('/dashboard');
        } else {
            (window as any).setLoginError('Nieprawidłowe hasło.');
        }
    };


    if (isLoading) {
         return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex animate-fade-in flex-col items-center gap-6">
                     <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                        SmartHouse
                    </h1>
                </div>
            </div>
        );
    }
    
    return <LoginView coordinators={coordinators} onLogin={handleLogin} />;
}

    
