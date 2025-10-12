
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building, Loader2 } from 'lucide-react';
import type { Coordinator } from '@/types';

interface LoginViewProps {
  onLogin: (user: { name: string }, password?: string) => Promise<void>;
  isLoading: boolean;
}

export function LoginView({ onLogin, isLoading }: LoginViewProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
        await onLogin({ name: name.trim() }, password);
    } finally {
        setIsLoggingIn(false);
    }
  };
  
  const handleSetError = (message: string) => {
    setError(message);
  }
  
  React.useEffect(() => {
    (window as any).setLoginError = handleSetError;
    return () => {
      delete (window as any).setLoginError;
    }
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pt-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border bg-background">
             <Building className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Witaj w SmartHouse</CardTitle>
          <CardDescription>Zaloguj się, aby kontynuować</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Imię i nazwisko / Login</Label>
                    <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError('');
                    }}
                    placeholder="Jan Kowalski lub admin"
                    required
                    disabled={isLoggingIn || isLoading}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="password">Hasło</Label>
                    <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                    }}
                    placeholder="Wprowadź hasło"
                    required
                    disabled={isLoggingIn || isLoading}
                    />
                </div>
                 {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                 {isLoading && <p className="text-sm font-medium text-muted-foreground text-center">Ładowanie konfiguracji...</p>}
            </CardContent>
            <CardFooter className="flex-col gap-4">
                <Button type="submit" className="w-full" disabled={isLoggingIn || isLoading}>
                    {isLoggingIn ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Logowanie...
                        </>
                    ) : 'Zaloguj się'}
                </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
