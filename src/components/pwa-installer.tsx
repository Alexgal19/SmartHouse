
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Define an interface for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Extend the Window interface to include our custom property
declare global {
  interface Window {
    pwaInstallHandler: {
      event?: BeforeInstallPromptEvent;
    };
  }
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

    const updateInstallPrompt = useCallback(() => {
        setInstallPrompt(window.pwaInstallHandler?.event || null);
    }, []);

    useEffect(() => {
        // Check immediately on mount in case the event has already fired
        updateInstallPrompt();

        // Listen for our custom event which is dispatched from the script in layout.tsx
        window.addEventListener('pwa-install-ready', updateInstallPrompt);

        // Also listen for the appinstalled event to clear the prompt
        window.addEventListener('appinstalled', () => {
            if (window.pwaInstallHandler) {
              window.pwaInstallHandler.event = undefined;
            }
            updateInstallPrompt();
        });

        return () => {
            window.removeEventListener('pwa-install-ready', updateInstallPrompt);
        };
    }, [updateInstallPrompt]);

    const handleInstallClick = () => {
        const promptEvent = window.pwaInstallHandler?.event;
        if (!promptEvent) return;

        promptEvent.prompt();
        promptEvent.userChoice.then(() => {
            if (window.pwaInstallHandler) {
              window.pwaInstallHandler.event = undefined;
            }
            document.body.classList.remove('install-ready');
            updateInstallPrompt();
        });
    };

    return (
        <PWAInstallerContext.Provider value={{ installPrompt, handleInstallClick }}>
            {children}
        </PWAInstallerContext.Provider>
    );
};
