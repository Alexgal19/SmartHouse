
"use client";

import React, { useState, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, LogOut, Trash2 } from 'lucide-react';
import type { SessionData, View, Notification, Settings } from '@/types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MobileSidebarToggle } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ModernHouseIcon } from './icons/modern-house-icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

const NotificationItem = ({ n, onClick, onDelete }: {n: Notification, onClick: (n: Notification) => void, onDelete: (notificationId: string) => void}) => {
    
    const itemClasses = cn(
        "p-3 rounded-lg -mx-2 flex items-start gap-4 transition-colors group border-l-4",
        n.isRead ? 'opacity-70 border-transparent' : 'font-semibold',
        n.type === 'success' && 'bg-green-500/10 border-green-500',
        n.type === 'destructive' && 'bg-red-500/10 border-red-500',
        n.type === 'warning' && 'bg-yellow-500/10 border-yellow-500',
        n.type === 'info' && 'border-blue-500',
        !n.type && 'border-transparent'
    );
    
    const iconClasses = cn(
        'h-2.5 w-2.5 rounded-full mt-1.5',
        n.isRead ? 'bg-muted-foreground' : 'bg-primary animate-pulse',
        n.type === 'success' && !n.isRead && 'bg-green-500',
        n.type === 'destructive' && !n.isRead && 'bg-red-500',
        n.type === 'warning' && !n.isRead && 'bg-yellow-500',
        n.type === 'info' && !n.isRead && 'bg-blue-500'
    );


    return (
    <div 
        className={itemClasses}
        role={n.entityId ? "button" : "status"}
    >
        <div className="flex-shrink-0" onClick={() => n.entityId && onClick(n)}>
             <div className={iconClasses}></div>
        </div>
        <div className="flex-1" onClick={() => n.entityId && onClick(n)}>
            <p className="text-sm leading-tight">{n.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
                 przez {n.coordinatorName} &middot; {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: pl })}
            </p>
        </div>
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
                e.stopPropagation();
                onDelete(n.id);
            }}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    </div>
)
}

export default function Header({
  user,
  onLogout,
  notifications,
  settings,
  onNotificationClick,
  onClearNotifications,
  onDeleteNotification,
}: {
  user: SessionData;
  activeView: View;
  notifications: Notification[];
  settings: Settings | null;
  onNotificationClick: (notification: Notification) => void;
  onLogout: () => Promise<void>;
  onClearNotifications: () => void;
  onDeleteNotification: (notificationId: string) => void;
}) {
    const [selectedCoordinator, setSelectedCoordinator] = useState('all');
    const unreadCount = notifications.filter(n => !n.isRead).length;

    const sortedCoordinators = useMemo(() => {
        if (!settings) return [];
        return [...settings.coordinators].sort((a,b) => a.name.localeCompare(b.name));
    }, [settings]);

    const filteredNotifications = useMemo(() => {
        if (selectedCoordinator === 'all' || !user.isAdmin) {
            return notifications;
        }
        return notifications.filter(n => n.coordinatorId === selectedCoordinator);
    }, [notifications, selectedCoordinator, user.isAdmin]);


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <MobileSidebarToggle />
       <div className="flex items-center gap-2 text-foreground">
        <ModernHouseIcon className="h-6 w-6 text-primary" />
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
                {user.isAdmin && settings && (
                    <div className="py-4 space-y-2">
                        <Label>Filtruj wg koordynatora</Label>
                        <Select value={selectedCoordinator} onValueChange={setSelectedCoordinator}>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz koordynatora" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszyscy koordynatorzy</SelectItem>
                                {sortedCoordinators.map(c => (
                                    <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <ScrollArea className="h-[calc(100vh-8rem)] pr-6">
                    <div className="space-y-4 py-4">
                    {filteredNotifications.length > 0 ? (
                        filteredNotifications.map(n => <NotificationItem key={n.id} n={n} onClick={onNotificationClick} onDelete={onDeleteNotification} />)
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
