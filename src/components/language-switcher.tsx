
"use client";

import { usePathname, useRouter, locales } from '@/navigation';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useTransition } from 'react';


export default function LanguageSwitcher() {
    const t = useTranslations('LanguageSwitcher');
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const [isPending, startTransition] = useTransition();

    const onLocaleChange = (newLocale: (typeof locales)[number]) => {
        startTransition(() => {
            router.replace(pathname, {locale: newLocale});
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
                {locales.map((loc) => (
                    <DropdownMenuItem 
                        key={loc} 
                        onClick={() => onLocaleChange(loc)}
                        disabled={locale === loc}
                    >
                       {
                        {
                            'pl': 'Polski',
                            'en': 'English',
                            'uk': 'Українська',
                            'es': 'Español'
                        }[loc]
                       }
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
