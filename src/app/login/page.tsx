"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Download, Loader2 } from 'lucide-react';
import { usePWAInstaller } from '@/components/pwa-installer';

const ModernHouseIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
);

function LoginForm() {
    const router = useRouter();
    const { toast } = useToast();
    const { installPrompt, handleInstallClick } = usePWAInstaller();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const searchParams = useSearchParams();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Check for callbackUrl to redirect back to the original page (e.g. from push notification)
        const callbackUrl = searchParams.get('callbackUrl') || '/dashboard?view=dashboard';

        try {
            const { success, user } = await login(name, password);
            if (success && user) {
                toast({
                    title: `Witaj z powrotem, ${user.name}!`,
                    duration: 2000,
                });
                router.push(callbackUrl);
            } else {
                toast({
                    variant: "destructive",
                    title: "Błąd logowania",
                    description: "Nieprawidłowy login lub hasło."
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Wystąpił błąd",
                description: "Spróbuj ponownie później."
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <CardContent className="grid gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
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
            <CardFooter className="flex-col gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
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
    );
}

export default function LoginPage() {
    return (
        <div className="relative flex h-screen w-full items-center justify-center bg-muted/40 px-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full z-0">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
                <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-accent/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-secondary/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>
            <Card className="w-full max-w-sm z-10 animate-scale-in">
                <CardHeader className="items-center text-center animate-fade-in-up">
                    <ModernHouseIcon className="h-8 w-8 text-primary" />
                    <CardTitle>Witaj w SmartHouse</CardTitle>
                    <CardDescription>Zaloguj się, aby kontynuować</CardDescription>
                </CardHeader>
                <Suspense fallback={<div className="h-48 flex items-center justify-center text-muted-foreground">Ładowanie formularza...</div>}>
                    <LoginForm />
                </Suspense>
            </Card>
        </div>
    );
}
