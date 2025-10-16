
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
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (userName: string, userPassword?: string) => {
        setIsLoading(true);
        setLoginError('');
        try {
            const result = await login(userName, userPassword || '');
            if (!result.success) {
                setLoginError(result.error || "Wystąpił nieznany błąd.");
            }
            // Redirection is now handled on the server side in the login action
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
        <LoginView 
          onLogin={handleLogin} 
          isLoading={isLoading} 
          loginError={loginError} 
          setLoginError={setLoginError}
          name={name}
          setName={setName}
          password={password}
          setPassword={setPassword}
        />
      </div>
    );
}
