
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
        
        // The try...catch block is removed to allow Next.js to handle the redirect.
        // The login server action will handle errors and redirects internally.
        const result = await login(userName, userPassword || '');
        
        // This code will only run if the login fails AND doesn't redirect.
        if (result && !result.success) {
            setLoginError(result.error || "Wystąpił nieznany błąd.");
        } else if (result && result.success && !result.redirecting) {
            // Fallback in case redirect doesn't happen, though it should.
             router.push('/dashboard');
        }

        // If the login is unsuccessful, we need to turn off the loading state.
        // If it's successful, the page will redirect, so this won't matter.
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
