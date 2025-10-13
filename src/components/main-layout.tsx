
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider
} from '@/components/ui/sidebar';
import Header from './header';
import { MobileNav } from './mobile-nav';
import type { View, Notification, Coordinator } from '@/types';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users, Globe } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { clearAllNotifications, markNotificationAsRead, getNotifications } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useTranslations, NextIntlClientProvider } from 'next-intl';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Button } from './ui/button';
import Link from 'next/link';


const navItems: { view: View; icon: React.ElementType; label: string }[] = [
    { view: 'dashboard', icon: Home, label: 'pulpit' },
    { view: 'employees', icon: Users, label: 'employees' },
    { view: 'inspections', icon: ClipboardList, label: 'inspections' },
    { view: 'settings', icon: SettingsIcon, label: 'settings' },
];

const locales = [
    { code: 'pl', name: 'Polski' },
    { code: 'en', name: 'English' },
    { code: 'uk', name: 'Українська' },
    { code: 'es', name: 'Español' },
];

const LanguageSwitcher = () => {
    const t = useTranslations('LanguageSwitcher');
    const pathname = usePathname();
    const currentLocale = pathname.split('/')[1];

    const getCleanPath = () => {
        const parts = pathname.split('/');
        parts.splice(1, 1); // remove locale
        return parts.join('/') || '/';
    }

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
                    <Link href={getCleanPath()} locale={locale.code} key={locale.code}>
                        <DropdownMenuItem className={currentLocale === locale.code ? 'font-bold' : ''}>
                           {locale.name}
                        </DropdownMenuItem>
                    </Link>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


export default function MainLayout({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: any;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const t = useTranslations('Navigation');

    const [currentUser, setCurrentUser] = useState<Coordinator | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    
    const activeView = useMemo(() => {
        return (searchParams.get('view') as View) || 'dashboard';
    }, [searchParams]);

    useEffect(() => {
        const checkUser = () => {
            try {
                const loggedInUser = sessionStorage.getItem('currentUser');
                if (loggedInUser) {
                    const user = JSON.parse(loggedInUser);
                    setCurrentUser(user);
                     getNotifications()
                        .then(notificationsData => setAllNotifications(notificationsData.map((n:any) => ({...n, createdAt: new Date(n.createdAt)}))))
                        .catch(() => toast({variant: "destructive", title: t('toast.error'), description: t('toast.notificationLoadError')}));
                } else {
                    router.push('/');
                }
            } catch (error) {
                router.push('/');
            } finally {
                setIsLoading(false);
            }
        };

        checkUser();

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'currentUser') {
                checkUser();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };

    }, [router, toast, t]);
    
    const handleLogout = () => {
        sessionStorage.removeItem('currentUser');
        setCurrentUser(null);
        router.push('/');
    };

    const handleNotificationClick = async (notification: Notification, employeeId?: string) => {
        if (employeeId) {
             router.push(`/dashboard?view=employees&edit=${employeeId}`);
        }
        
        if (!notification.isRead) {
            setAllNotifications(prev => prev.map(n => n.id === notification.id ? {...n, isRead: true} : n));
            await markNotificationAsRead(notification.id);
        }
    };

     const handleClearNotifications = async () => {
        if (!currentUser?.isAdmin) {
             toast({ variant: "destructive", title: t('toast.permissionErrorTitle'), description: t('toast.permissionErrorDescription') });
             return;
        }
        try {
            await clearAllNotifications();
            setAllNotifications([]);
            toast({ title: t('toast.success'), description: t('toast.clearNotificationsSuccess') });
        } catch (e: any) {
             toast({ variant: "destructive", title: t('toast.error'), description: e.message || t('toast.clearNotificationsError') });
        }
    }


    const filteredNotifications = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.isAdmin) {
            return allNotifications;
        }
        return allNotifications.filter(n => n.coordinatorId === currentUser.uid);
    }, [currentUser, allNotifications]);

    const visibleNavItems = useMemo(() => {
        if (currentUser?.isAdmin) {
            return navItems;
        }
        return navItems.filter(item => item.view !== 'settings');
    }, [currentUser]);

    if (isLoading || !currentUser) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex animate-fade-in flex-col items-center gap-6">
                     <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                        SmartHouse
                    </h1>
                </div>
            </div>
        );
    }
    
    return (
       <NextIntlClientProvider locale={locale} messages={messages}>
        <SidebarProvider>
            <div className="flex h-screen w-full bg-muted/50">
                <Sidebar>
                    <SidebarHeader>
                        <div className="flex items-center gap-2">
                            <Building className="h-8 w-8 text-primary" />
                            <span className="font-semibold text-xl group-data-[collapsible=icon]:hidden">SmartHouse</span>
                        </div>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarMenu>
                            {visibleNavItems.map(item => (
                                <SidebarMenuItem key={item.view}>
                                    <SidebarMenuButton 
                                        onClick={() => {
                                            if (item.view === 'settings' && !currentUser?.isAdmin) return;
                                            router.push(`/dashboard?view=${item.view}`)
                                        }} 
                                        isActive={activeView === item.view}
                                        tooltip={t(item.label)}
                                        disabled={item.view === 'settings' && !currentUser?.isAdmin}
                                    >
                                        <item.icon />
                                        <span>{t(item.label)}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarContent>
                    <SidebarFooter>
                    </SidebarFooter>
                </Sidebar>
                <div className="flex flex-1 flex-col">
                    <Header 
                        user={currentUser} 
                        activeView={activeView} 
                        notifications={filteredNotifications} 
                        onNotificationClick={(n) => handleNotificationClick(n, n.employeeId)} 
                        onLogout={handleLogout} 
                        onClearNotifications={handleClearNotifications}
                        languageSwitcher={<LanguageSwitcher />}
                    />
                    <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-6 pt-4">
                    {children}
                    </main>
                </div>
                
                <MobileNav activeView={activeView} setActiveView={(v) => router.push(`/dashboard?view=${v}`)} navItems={visibleNavItems} currentUser={currentUser}/>
            </div>
        </SidebarProvider>
      </NextIntlClientProvider>
    );
}

    