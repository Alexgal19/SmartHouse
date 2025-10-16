
"use client";

import React, { useState, useEffect } from 'react';
import { LoginView } from "@/components/login-view";
import type { Settings } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { login } from '@/lib/session';

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    const handleLogin = async (user: { name: string }, password?: string) => {
        setIsLoading(true);
        setLoginError('');
        try {
            const result = await login(user.name, password || '');
            if (result.success) {
                router.push('/dashboard');
            } else {
                setLoginError(result.error || "Wystąpił nieznany błąd.");
            }
        } catch (err: any) {
             toast({
                variant: "destructive",
                title: "Błąd logowania",
                description: `Wystąpił nieoczekiwany błąd. ${err.message}`
            });
             setLoginError("Błąd serwera. Spróbuj ponownie później.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
      <div className="relative h-screen w-full">
        <LoginView onLogin={handleLogin} isLoading={isLoading} loginError={loginError} setLoginError={setLoginError} />
      </div>
    );
}
