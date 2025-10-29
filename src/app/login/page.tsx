
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
        <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white px-4 overflow-hidden relative">
            {/* Gradient Background */}
            <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-primary/30 rounded-full filter blur-3xl opacity-50 animate-blob"></div>
            <div className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-purple-500/30 rounded-full filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4 w-96 h-96 bg-orange-500/30 rounded-full filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
            
            <Card className="w-full max-w-sm animate-fade-in-up bg-black/30 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl text-white">
                <form onSubmit={handleLogin}>
                    <CardHeader className="items-center text-center space-y-4">
                        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 border border-primary/20 shadow-inner">
                            <Building className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold">Witaj w SmartHouse</CardTitle>
                            <CardDescription className="text-white/60">Zaloguj się, aby kontynuować</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2 text-left">
                            <Label htmlFor="name" className="text-white/80">Imię i nazwisko / Login</Label>
                            <Input 
                                id="name" 
                                type="text" 
                                placeholder="np. admin lub Jan Kowalski"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required 
                                disabled={isLoading}
                                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div className="grid gap-2 text-left">
                            <Label htmlFor="password">Hasło</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                                disabled={isLoading}
                                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-4">
                        <Button className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" type="submit" disabled={isLoading || password === ''}>
                            {isLoading ? <Loader2 className="animate-spin" /> : "Zaloguj się"}
                        </Button>
                        {installPrompt && (
                            <Button variant="outline" className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white/80" onClick={handleInstallClick}>
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

