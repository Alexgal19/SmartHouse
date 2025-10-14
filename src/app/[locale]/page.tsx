
"use client";

import React, { useState, useEffect } from 'react';
import { LoginView } from "@/components/login-view";
import { getSettings } from "@/lib/actions";
import type { Coordinator, Settings } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/language-switcher';

export default function LoginPage() {
    const t = useTranslations('LoginPage');
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
                    title: t('toast.criticalErrorTitle'),
                    description: `${t('toast.settingsLoadError')} ${err.message}`
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [toast, t]);

    const handleLogin = async (user: {name: string}, password?: string) => {
        if (!settings) {
            setLoginError(t('settingsNotLoadedError'));
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
                     setLoginError(t('incorrectAdminPasswordError'));
                }
                return;
            }

            if (coordinators.length === 0) {
                setLoginError(t('coordinatorListEmptyError'));
                return;
            }

            const coordinator = coordinators.find(c => c.name.toLowerCase() === lowerCaseName);

            if (!coordinator) {
                setLoginError(t('accessDeniedError'));
                return;
            }
            
             if (!password) {
                setLoginError(t('passwordRequiredError'));
                return;
            }

            if (coordinator.password === password) {
                sessionStorage.setItem('currentUser', JSON.stringify(coordinator));
                router.push('/dashboard');
            } else {
                setLoginError(t('incorrectPasswordError'));
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: t('toast.loginErrorTitle'),
                description: `${t('toast.unexpectedError')} ${err.message}`
            });
             setLoginError(t('serverError'));
        }
    };
    
    return (
      <div className="relative h-screen w-full">
        <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>
        <LoginView onLogin={handleLogin} isLoading={isLoading} loginError={loginError} setLoginError={setLoginError} />
      </div>
    );
}
