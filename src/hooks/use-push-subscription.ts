"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMainLayout } from '@/components/main-layout';
import { messagingPromise } from '@/lib/firebase';
import { getToken, deleteToken, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export const usePushSubscription = () => {
    const { toast } = useToast();
    const router = useRouter();
    const {
        currentUser,
        handleUpdateCoordinatorSubscription,
        pushSubscription,
        setPushSubscription,
        settings,
    } = useMainLayout();

    const [isSubscribing, setIsSubscribing] = useState(false);
    const [isUnsubscribing, setIsUnsubscribing] = useState(false);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const setupMessageListener = async () => {
            const messagingInstance = await messagingPromise;
            if (!messagingInstance) return;

            unsubscribe = onMessage(messagingInstance, (payload) => {
                console.log('Foreground message received:', payload);
                const data = payload.data || {};
                const title = data.title || payload.notification?.title || 'Nowe powiadomienie';
                const body = data.body || payload.notification?.body;
                const url = data.url || data.click_action;

                toast({
                    title: title,
                    description: body,
                    duration: 10000,
                    // Add "Otwórz" (Open) action button if URL is present in push data
                    ...(url ? {
                        action: React.createElement(ToastAction, {
                            altText: 'Otwórz',
                            onClick: () => router.push(url),
                        }, 'Otwórz'),
                    } : {}),
                });
            });
        };

        if (typeof window !== 'undefined') {
            setupMessageListener();
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [toast, router]);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const checkToken = async () => {
                try {
                    const messagingInstance = await messagingPromise;
                    if (!messagingInstance) return;

                    if ('serviceWorker' in navigator) {
                        const registration = await navigator.serviceWorker.ready;
                        const currentToken = await getToken(messagingInstance, {
                            vapidKey: process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY,
                            serviceWorkerRegistration: registration
                        });
                        if (currentToken) {
                            setPushSubscription(currentToken);

                            if (currentUser && settings) {
                                const coordinator = settings.coordinators.find(c => c.uid === currentUser.uid);
                                if (coordinator && coordinator.pushSubscription !== currentToken) {
                                    handleUpdateCoordinatorSubscription(currentToken);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[FCM] Failed to retrieve push token on startup:', e);
                }
            };
            checkToken();
        }
    }, [setPushSubscription, currentUser, settings, handleUpdateCoordinatorSubscription]);

    const subscribe = useCallback(async () => {
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
            const messagingInstance = await messagingPromise;
            if (!messagingInstance) {
                throw new Error("Firebase Messaging not supported");
            }

            if (!('Notification' in window)) {
                throw new Error("Notifications not supported");
            }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error("Permission denied");
            }

            const registration = await navigator.serviceWorker.ready;
            const token = await getToken(messagingInstance, {
                vapidKey: process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                await handleUpdateCoordinatorSubscription(token);
                setPushSubscription(token);
                toast({
                    title: 'Sukces!',
                    description: 'Powiadomienia push zostały włączone.',
                });
            } else {
                throw new Error("No token received");
            }
        } catch (error) {
            console.error('Failed to subscribe:', error);

            let errorMessage = 'Nie udało się włączyć powiadomień. Sprawdź uprawnienia w przeglądarce.';

            // Check for specific Firebase errors
            if (error && typeof error === 'object' && 'code' in error) {
                const firebaseError = error as { code: string; message: string };

                if (firebaseError.code === 'messaging/token-subscribe-failed') {
                    errorMessage = 'Powiadomienia push nie są skonfigurowane w Firebase. Skontaktuj się z administratorem systemu.';
                } else if (firebaseError.message?.includes('authentication credential')) {
                    errorMessage = 'Firebase Cloud Messaging wymaga konfiguracji w konsoli Firebase. Skontaktuj się z administratorem.';
                } else if (firebaseError.code === 'messaging/permission-blocked') {
                    errorMessage = 'Powiadomienia są zablokowane w przeglądarce. Odblokuj je w ustawieniach strony.';
                }
            }

            toast({
                variant: 'destructive',
                title: 'Błąd powiadomień push',
                description: errorMessage,
            });
        } finally {
            setIsSubscribing(false);
        }
    }, [toast, handleUpdateCoordinatorSubscription, setPushSubscription]);

    const unsubscribe = useCallback(async () => {
        setIsUnsubscribing(true);
        try {
            const messagingInstance = await messagingPromise;
            if (messagingInstance) {
                await deleteToken(messagingInstance);
            }
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
    }, [toast, handleUpdateCoordinatorSubscription, setPushSubscription]);

    const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

    return {
        pushSubscription,
        subscribe,
        unsubscribe,
        isSubscribing,
        isUnsubscribing,
        isSupported
    };
};
