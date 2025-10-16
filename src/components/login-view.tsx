
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building, Loader2 } from 'lucide-react';

interface LoginViewProps {
  onLogin: (name: string, password?: string) => Promise<void>;
  isLoading: boolean;
  loginError: string;
  setLoginError: (error: string) => void;
  name: string;
  setName: (name: string) => void;
  password: string;
  setPassword: (password: string) => void;
}

export function LoginView({ onLogin, isLoading, loginError, setLoginError, name, setName, password, setPassword }: LoginViewProps) {
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    await onLogin(name.trim(), password);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/50 p-4 animate-in fade-in-0 duration-500">
      <Card className="w-full max-w-sm animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader className="text-center p-6 pt-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border bg-background">
             <Building className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Witaj w SmartHouse</CardTitle>
          <CardDescription>Zaloguj się, aby kontynuować</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 p-6 pt-0">
                <div className="space-y-2">
                    <Label htmlFor="name">Imię i nazwisko / Login</Label>
                    <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. admin lub Jan Kowalski"
                    required
                    disabled={isLoading}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="password">Hasło</Label>
                    <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Wprowadź swoje hasło"
                    required
                    disabled={isLoading}
                    />
                </div>
                 {loginError && <p className="text-sm font-medium text-destructive">{loginError}</p>}
            </CardContent>
            <CardFooter className="flex-col gap-4 p-6 pt-0">
                <Button type="submit" className="w-full" disabled={isLoading || !name || !password}>
                    {isLoading ? (
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
