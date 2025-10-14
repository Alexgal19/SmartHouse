
"use client";

import { usePathname } from 'next/navigation';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';
import { locales } from '@/navigation';
import { useTranslations } from 'next-intl';

interface LanguageSwitcherProps {
    onLocaleChange: (locale: string) => void;
}

export default function LanguageSwitcher({ onLocaleChange }: LanguageSwitcherProps) {
    const t = useTranslations('LanguageSwitcher');
    const pathname = usePathname();
    
    const currentLocale = pathname.split('/')[1];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">{t('title')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {locales.map((locale) => (
                    <DropdownMenuItem 
                        key={locale} 
                        onClick={() => onLocaleChange(locale)}
                        className={currentLocale === locale ? 'font-bold' : ''}
                    >
                       {
                        {
                            'pl': 'Polski',
                            'en': 'English',
                            'uk': 'Українська',
                            'es': 'Español'
                        }[locale]
                       }
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

    