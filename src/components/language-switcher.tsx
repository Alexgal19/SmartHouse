
"use client";

import { usePathname, useRouter } from '@/navigation';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';
import { locales } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';


export default function LanguageSwitcher() {
    const t = useTranslations('LanguageSwitcher');
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const onLocaleChange = (locale: string) => {
        startTransition(() => {
            router.replace(pathname, {locale});
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isPending}>
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">{t('title')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {locales.map((locale) => (
                    <DropdownMenuItem 
                        key={locale} 
                        onClick={() => onLocaleChange(locale)}
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
