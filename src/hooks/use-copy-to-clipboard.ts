"use client";

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useCopyToClipboard = () => {
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const { toast } = useToast();

    const copyToClipboard = async (text: string, successMessage?: string) => {
        if (!navigator?.clipboard) {
            console.warn('Clipboard not supported');
            toast({
                variant: 'destructive',
                title: 'Błąd',
                description: 'Twoja przeglądarka не obsługuje schowka.',
            });
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(text);
            if (successMessage) {
                toast({
                    title: 'Skopiowano!',
                    description: successMessage,
                });
            }
            return true;
        } catch (error) {
            console.warn('Copy failed', error);
            setCopiedText(null);
            toast({
                variant: 'destructive',
                title: 'Błąd kopiowania',
                description: 'Nie udało się skopiować do schowka.',
            });
            return false;
        }
    };

    return { copiedText, copyToClipboard };
};
