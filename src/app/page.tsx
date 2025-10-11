
"use client";

import { LoginView } from "@/components/login-view";
import { getSettings } from "@/lib/actions";
import type { Coordinator } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();

    const handleLogin = async (user: {name: string}, password?: string) => {
        try {
            const settings = await getSettings();
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
                     (window as any).setLoginError('Nieprawidłowe hasło administratora.');
                }
                return;
            }

            if (coordinators.length === 0) {
                (window as any).setLoginError('Lista koordynatorów jest pusta lub nie załadowała się. Spróbuj ponownie.');
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
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Błąd krytyczny",
                description: `Nie udało się pobrać ustawień aplikacji. ${err.message}`
            });
             (window as any).setLoginError('Błąd serwera. Spróbuj ponownie później.');
        }
    };
    
    return <LoginView onLogin={handleLogin} />;
}
