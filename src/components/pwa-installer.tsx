
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

export const PWAInstaller = ({ children }: { children: React.ReactNode }) => {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Register service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.service-worker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration);
                }).catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
            });
        }
        
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

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
            setInstallPrompt(null);
        });
    };

    return (
        <PWAInstallerContext.Provider value={{ installPrompt, handleInstallClick }}>
            {children}
        </PWAInstallerContext.Provider>
    );
};
