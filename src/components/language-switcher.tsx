
"use client";

import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';
import { locales } from '@/navigation';

export default function LanguageSwitcher() {
    const t = useTranslations('LanguageSwitcher');
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    const pathSegments = pathname.split('/');
    const currentLocale = pathSegments[1];

    const handleLocaleChange = (locale: string) => {
        const pathWithoutLocale = pathSegments.slice(2).join('/');
        
        const newPath = `/${locale}/${pathWithoutLocale}`;
        
        const currentSearchParams = new URLSearchParams(searchParams.toString());
        const queryString = currentSearchParams.toString();

        const finalPath = queryString ? `${newPath}?${queryString}` : newPath;
        window.location.href = finalPath;
    };

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
                        className={currentLocale === locale ? 'font-bold' : ''}
                        onSelect={() => handleLocaleChange(locale)}
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
