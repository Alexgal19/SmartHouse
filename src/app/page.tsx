
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
        
        const result = await login(userName, userPassword || '');
        
        if (result && !result.success) {
            setLoginError(result.error || "Wystąpił nieznany błąd.");
        } else if (result && result.success && !result.redirecting) {
             router.push('/dashboard');
        }

        setIsLoading(false);
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
