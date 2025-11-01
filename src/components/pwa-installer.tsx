
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// Define an interface for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallerContextType {
    installPrompt: BeforeInstallPromptEvent | null;
    handleInstallClick: () => void;
}

const PWAInstallerContext = createContext<PWAInstallerContextType | null>(null);

export const usePWAInstaller = () => {
    const context = useContext(PWAInstallerContext);
    if (!context) {
        throw new Error("usePWAInstaller must be used within a PWAInstaller provider");
    }
    return context;
}

// A global variable to hold the event.
let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const PWAInstaller = ({ children }: { children: React.ReactNode }) => {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(deferredPrompt);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;
            deferredPrompt = promptEvent;
            setInstallPrompt(promptEvent);
        };

        // If the event has already been captured, use it.
        if (deferredPrompt) {
            setInstallPrompt(deferredPrompt);
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for appinstalled event
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            deferredPrompt = null;
            setInstallPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            // We set deferredPrompt to null because it can't be used again.
            deferredPrompt = null;
            setInstallPrompt(null);
        });
    };

    return (
        <PWAInstallerContext.Provider value={{ installPrompt, handleInstallClick }}>
            {children}
        </PWAInstallerContext.Provider>
    );
};
