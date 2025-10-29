"use client";

import React, { useState, useEffect } from 'react';
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
import { Building, Download, Loader2 } from 'lucide-react';

// Define an interface for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

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
                router.push('/dashboard?view=dashboard');
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
    
    const handleInstallClick = () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            setInstallPrompt(null);
        });
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-muted/40 px-4">
            <Card className="w-full max-w-sm">
                <form onSubmit={handleLogin}>
                    <CardHeader className="items-center text-center">
                        <Building className="h-8 w-8 text-primary" />
                        <CardTitle>Witaj w SmartHouse</CardTitle>
                        <CardDescription>Zaloguj się, aby kontynuować</CardDescription>
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
                            />
                        </div>
                        <div className="grid gap-2 text-left">
                            <Label htmlFor="password">Hasło</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                                disabled={isLoading}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-4">
                        <Button className="w-full" type="submit" disabled={isLoading || password === ''}>
                            {isLoading ? <Loader2 className="animate-spin" /> : "Zaloguj się"}
                        </Button>
                        {installPrompt && (
                            <Button variant="outline" className="w-full" onClick={handleInstallClick}>
                                <Download className="mr-2 h-4 w-4" />
                                Zainstaluj aplikację
                            </Button>
                        )}
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}