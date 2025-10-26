

// This component represents the main header of the application.
// It includes user information, notifications, and logout functionality.

"use client";

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, CircleUser, Home, Settings, Users, ClipboardList, Archive, LogOut, Trash2 } from 'lucide-react';
import type { SessionData, View, Notification } from '@/types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useMainLayout } from './main-layout';
import { MobileSidebarToggle } from '@/components/ui/sidebar';
import { Building } from 'lucide-react';
import { cn } from '@/lib/utils';


const viewTitles: Record<View, string> = {
  dashboard: 'Pulpit',
  employees: 'Pracownicy',
  settings: 'Ustawienia',
  inspections: 'Inspekcje',
  equipment: 'Wyposażenie',
};

const viewIcons: Record<View, React.ElementType> = {
    dashboard: Home,
    employees: Users,
    settings: Settings,
    inspections: ClipboardList,
    equipment: Archive
}

const NotificationItem = ({ n, onClick }: {n: Notification, onClick: (n: Notification) => void}) => (
    <div 
        className={cn(
            "p-3 rounded-lg -mx-2 flex items-start gap-4 transition-colors",
            n.isRead ? 'opacity-70' : 'bg-primary/5',
            n.employeeId && 'cursor-pointer hover:bg-primary/10'
        )}
        onClick={() => n.employeeId && onClick(n)}
        role={n.employeeId ? "button" : "status"}
    >
        <div className="flex-shrink-0">
             <div className={cn('h-2.5 w-2.5 rounded-full mt-1.5', n.isRead ? 'bg-muted-foreground' : 'bg-primary animate-pulse' )}></div>
        </div>
        <div>
            <p className="text-sm font-medium leading-tight">{n.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
                 {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: pl })}
            </p>
        </div>
    </div>
)

export default function Header({
  user,
  activeView,
  notifications,
  onNotificationClick,
  onLogout,
  onClearNotifications
}: {
  user: SessionData;
  activeView: View;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onLogout: () => Promise<void>;
  onClearNotifications: () => void;
}) {
    const { refreshData, handleRefreshStatuses } = useMainLayout();
    const ActiveViewIcon = viewIcons[activeView] || Home;
    const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <MobileSidebarToggle />
       <div className="flex items-center gap-2 text-foreground">
        <Building className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">SmartHouse</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        
        <Sheet>
            <SheetTrigger asChild>
                 <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-accent hover:text-accent-foreground">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">{unreadCount}</span>}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md" side="right">
                <SheetHeader className="flex-row justify-between items-center pr-6">
                    <div>
                        <SheetTitle>Powiadomienia</SheetTitle>
                        <SheetDescription>Ostatnie zmiany w systemie.</SheetDescription>
                    </div>
                     {notifications.length > 0 && user.isAdmin && (
                        <Button variant="ghost" size="icon" onClick={onClearNotifications}>
                            <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                     )}
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] pr-6">
                    <div className="space-y-4 py-4">
                    {notifications.length > 0 ? (
                        notifications.map(n => <NotificationItem key={n.id} n={n} onClick={onNotificationClick} />)
                    ) : (
                        <div className="text-center text-muted-foreground py-12">Brak nowych powiadomień.</div>
                    )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="overflow-hidden rounded-full text-foreground hover:bg-accent hover:text-accent-foreground">
              <LogOut className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.name} ({user.isAdmin ? 'Admin' : 'Koordynator'})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Profil</DropdownMenuItem>
            <DropdownMenuItem disabled>Wsparcie</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Wyloguj się
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

