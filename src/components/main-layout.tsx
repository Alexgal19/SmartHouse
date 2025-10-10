
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar';
import Header from './header';
import { MobileNav } from './mobile-nav';
import type { View, Notification, Coordinator } from '@/types';
import { Building, ClipboardList, Home, Settings as SettingsIcon, Users } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { clearAllNotifications, markNotificationAsRead, getNotifications } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';


const navItems: { view: View; icon: React.ElementType; label: string }[] = [
    { view: 'dashboard', icon: Home, label: 'Pulpit' },
    { view: 'employees', icon: Users, label: 'Pracownicy' },
    { view: 'inspections', icon: ClipboardList, label: 'Inspekcje' },
    { view: 'settings', icon: SettingsIcon, label: 'Ustawienia' },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();

    const [currentUser, setCurrentUser] = useState<Coordinator | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    
    const activeView = useMemo(() => {
        const path = pathname.split('/').pop() || 'dashboard';
        return path as View;
    }, [pathname]);

    useEffect(() => {
        try {
            const loggedInUser = sessionStorage.getItem('currentUser');
            if (loggedInUser) {
                const user = JSON.parse(loggedInUser);
                setCurrentUser(user);
                 getNotifications()
                    .then(notificationsData => setAllNotifications(notificationsData.map((n:any) => ({...n, createdAt: new Date(n.createdAt)}))))
                    .catch(() => toast({variant: "destructive", title: "Błąd", description: "Nie udało się załadować powiadomień"}));
            } else {
                router.push('/');
            }
        } catch (error) {
            router.push('/');
        } finally {
            setIsLoading(false);
        }
    }, [router, toast]);
    
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
             toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administrator może usuwać powiadomienia." });
             return;
        }
        try {
            await clearAllNotifications();
            setAllNotifications([]);
            toast({ title: "Sukces", description: "Wszystkie powiadomienia zostały usunięte." });
        } catch (e: any) {
             toast({ variant: "destructive", title: "Błąd", description: e.message || "Nie udało się usunąć powiadomień." });
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
        // Simplified: assuming non-admins can see everything but 'settings' check is handled by click handler
        return navItems;
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
                                    tooltip={item.label}
                                    disabled={item.view === 'settings' && !currentUser?.isAdmin}
                                >
                                    <item.icon />
                                    <span>{item.label}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                </SidebarFooter>
            </Sidebar>
            <div className="flex flex-1 flex-col">
                <Header user={currentUser} activeView={activeView} notifications={filteredNotifications} onNotificationClick={(n) => handleNotificationClick(n, n.employeeId)} onLogout={handleLogout} onClearNotifications={handleClearNotifications} />
                <main className="flex-1 overflow-y-auto px-2 sm:px-6 pb-6 pt-4">
                   {children}
                </main>
            </div>
            
            <MobileNav activeView={activeView} setActiveView={(v) => router.push(`/dashboard?view=${v}`)} navItems={visibleNavItems} currentUser={currentUser}/>
        </div>
    );
}
