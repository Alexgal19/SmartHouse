
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { BellRing, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMainLayout } from './main-layout';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const PushSubscriptionManager = () => {
    const { toast } = useToast();
    const { 
        currentUser, 
        handleUpdateCoordinatorSubscription,
        pushSubscription,
        setPushSubscription,
    } = useMainLayout();

    const [isSubscribing, setIsSubscribing] = useState(false);
    const [isUnsubscribing, setIsUnsubscribing] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(subscription => {
                    setPushSubscription(subscription);
                });
            });
        }
    }, [setPushSubscription]);

    const handleSubscribe = useCallback(async () => {
        if (!process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY) {
            toast({
                variant: 'destructive',
                title: 'Błąd konfiguracji',
                description: 'Klucz publiczny Web Push nie jest skonfigurowany.',
            });
            return;
        }

        setIsSubscribing(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY),
            });
            await handleUpdateCoordinatorSubscription(subscription);
            setPushSubscription(subscription);
            toast({
                title: 'Sukces!',
                description: 'Powiadomienia push zostały włączone.',
            });
        } catch (error) {
            console.error('Failed to subscribe:', error);
            toast({
                variant: 'destructive',
                title: 'Błąd',
                description: 'Nie udało się włączyć powiadomień. Sprawdź uprawnienia w przeglądarce.',
            });
        } finally {
            setIsSubscribing(false);
        }
    }, [toast, handleUpdateCoordinatorSubscription, setPushSubscription]);

    const handleUnsubscribe = useCallback(async () => {
        if (!pushSubscription) return;

        setIsUnsubscribing(true);
        try {
            await pushSubscription.unsubscribe();
            await handleUpdateCoordinatorSubscription(null);
            setPushSubscription(null);
            toast({
                title: 'Sukces!',
                description: 'Powiadomienia push zostały wyłączone.',
            });
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            toast({
                variant: 'destructive',
                title: 'Błąd',
                description: 'Nie udało się wyłączyć powiadomień.',
            });
        } finally {
            setIsUnsubscribing(false);
        }
    }, [pushSubscription, toast, handleUpdateCoordinatorSubscription, setPushSubscription]);

    if (!currentUser) return null;
    if (!('serviceWorker' in navigator && 'PushManager' in window)) return null;

    return (
        <Popover>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                             <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-accent hover:text-accent-foreground">
                                <BellRing className="h-5 w-5" />
                                {pushSubscription && (
                                     <span className="absolute bottom-1 right-1 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                     <TooltipContent>
                        <p>Powiadomienia Push</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h4 className="font-medium leading-none">Powiadomienia Push</h4>
                        <p className="text-sm text-muted-foreground">
                             {pushSubscription ? "Masz włączone powiadomienia na tym urządzeniu." : "Włącz, aby otrzymywać powiadomienia."}
                        </p>
                    </div>
                     {pushSubscription ? (
                        <Button 
                            variant="destructive" 
                            className="w-full"
                            onClick={handleUnsubscribe}
                            disabled={isUnsubscribing}
                        >
                            {isUnsubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Wyłącz powiadomienia
                        </Button>
                    ) : (
                        <Button
                            className="w-full"
                            onClick={handleSubscribe}
                            disabled={isSubscribing}
                        >
                            {isSubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Włącz powiadomienia
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};
