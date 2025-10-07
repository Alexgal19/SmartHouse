"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building } from 'lucide-react';
import type { Coordinator } from '@/types';

interface LoginViewProps {
  coordinators: Coordinator[];
  onLogin: (coordinator: Coordinator) => void;
}

export function LoginView({ coordinators, onLogin }: LoginViewProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const coordinator = coordinators.find(c => c.name.toLowerCase() === name.toLowerCase().trim());
    if (coordinator) {
      onLogin(coordinator);
    } else {
      setError('Brak dostępu. Sprawdź, czy Twoje imię i nazwisko są poprawne.');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border bg-background">
             <Building className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Witaj w SmartHouse</CardTitle>
          <CardDescription>Zaloguj się, aby kontynuować</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Imię i nazwisko</Label>
                    <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError('');
                    }}
                    placeholder="Jan Kowalski"
                    required
                    />
                </div>
                 {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            </CardContent>
            <CardFooter>
                <Button type="submit" className="w-full">Zaloguj się</Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
