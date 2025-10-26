
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { login } from '@/lib/auth';
import { Building } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { success, user } = await login(name, password);
            if (success && user) {
                toast({
                    title: "Zalogowano pomyślnie",
                    description: `Witaj, ${user.name}!`,
                });
                router.push('/dashboard?view=employees');
            } else {
                 toast({
                    variant: "destructive",
                    title: "Błąd logowania",
                    description: "Wystąpił nieznany błąd.",
                });
            }
        } catch (err: unknown) {
             toast({
                variant: "destructive",
                title: "Błąd serwera",
                description: err instanceof Error ? err.message : "Nie można było połączyć się z serwerem.",
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background px-4">
            <Card className="w-full max-w-sm animate-fade-in-up shadow-xl rounded-2xl">
                <form onSubmit={handleLogin}>
                    <CardHeader className="items-center text-center space-y-4">
                        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
                            <Building className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-2xl">Witaj w SmartHouse</CardTitle>
                            <CardDescription>Zaloguj się, aby kontynuować</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2 text-left">
                            <Label htmlFor="name">Imię i nazwisko / Login</Label>
                            <Input 
                                id="name" 
                                type="text" 
                                placeholder="np. admin lub Jan Kowalski"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required 
                                disabled={isLoading}
                                className="bg-muted/50"
                            />
                        </div>
                        <div className="grid gap-2 text-left">
                            <Label htmlFor="password">Hasło</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                placeholder="Wprowadź swoje hasło"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                                disabled={isLoading}
                                className="bg-muted/50"
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" type="submit" disabled={isLoading || password === ''}>
                            {isLoading ? "Logowanie..." : "Zaloguj się"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
