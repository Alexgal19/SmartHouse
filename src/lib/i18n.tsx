"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Locale } from 'date-fns';
import { pl as plDateLocale } from 'date-fns/locale/pl';
import { enUS } from 'date-fns/locale/en-US';
import { pl } from './translations/pl';
import { en } from './translations/en';

export type Language = 'pl' | 'en';
type TranslationRecord = Record<string, string>;
const TRANSLATIONS: Record<Language, TranslationRecord> = { pl, en };
const STORAGE_KEY = 'smarthouse_lang';

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

type LanguageContextType = {
    lang: Language;
    setLang: (lang: Language) => void;
    t: TFunction;
    dateLocale: Locale;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<Language>('pl');

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
            if (stored === 'pl' || stored === 'en') setLangState(stored);
        } catch {}
    }, []);

    const setLang = useCallback((newLang: Language) => {
        setLangState(newLang);
        try { localStorage.setItem(STORAGE_KEY, newLang); } catch {}
    }, []);

    const t = useCallback<TFunction>((key, params) => {
        const dict = TRANSLATIONS[lang];
        let str = dict[key] ?? TRANSLATIONS['pl'][key] ?? key;
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                str = str.replaceAll(`{${k}}`, String(v));
            }
        }
        return str;
    }, [lang]);

    const dateLocale: Locale = lang === 'en' ? enUS : plDateLocale;

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, dateLocale }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
}
