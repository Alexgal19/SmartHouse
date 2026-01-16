

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
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';

const NotificationItem = ({ n, onClick, onDelete, onToggleReadStatus, style }: {
    n: Notification;
    onClick: (n: Notification) => void;
    onDelete: (notificationId: string) => void;
    onToggleReadStatus: (notificationId: string, isRead: boolean) => void;
    style?: React.CSSProperties
}) => {
    
    const itemClasses = cn(
        "p-3 rounded-lg -mx-2 flex items-start gap-3 transition-colors group border-l-4 animate-fade-in-up",
        n.isRead ? 'opacity-70 border-transparent hover:bg-muted/50' : 'font-semibold',
        n.type === 'success' && 'bg-green-500/10 border-green-500',
        n.type === 'destructive' && 'bg-red-500/10 border-red-500',
        n.type === 'warning' && 'bg-yellow-500/10 border-yellow-500',
        n.type === 'info' && 'border-blue-500',
        !n.type && 'border-transparent'
    );

    return (
    <div 
        className={itemClasses}
        role="status"
        style={style}
    >
        <div className="flex items-center pt-1">
            <Checkbox
                id={`notif-read-${n.id}`}
                checked={n.isRead}
                onCheckedChange={(checked) => {
                    onToggleReadStatus(n.id, !!checked);
                }}
            />
        </div>
        <div className="flex-1">
            <div 
                className={cn("w-full", n.entityId && "cursor-pointer")}
                onClick={() => n.entityId && onClick(n)}
            >
                <div className="flex w-full justify-between items-start">
                    <div className="flex-1">
                        <p className="text-sm leading-tight"><span className="font-bold">{n.actorName}</span> {n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: pl })}
                        </p>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 -mr-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(n.id);
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            {n.changes && n.changes.length > 0 && (
                <div className="w-full mt-2">
                    <div className="text-xs space-y-1 border-l-2 border-border pl-3 py-1">
                        {n.changes.map((change, index) => (
                            <p key={index} className="text-muted-foreground">
                            <span className="font-medium text-foreground/80">{change.field}:</span> {change.oldValue} &rarr; <span className="font-semibold text-foreground">{change.newValue}</span>
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
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
  onToggleNotificationReadStatus,
}: {
  user: SessionData;
  activeView: View;
  notifications: Notification[];
  settings: Settings | null;
  onNotificationClick: (notification: Notification) => void;
  onLogout: () => Promise<void>;
  onClearNotifications: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onToggleNotificationReadStatus: (notificationId: string, isRead: boolean) => void;
}) {
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    const [employeeNameFilter, setEmployeeNameFilter] = useState('');
    const unreadCount = notifications.filter(n => !n.isRead).length;

    const sortedCoordinators = useMemo(() => {
        if (!settings) return [];
        return [...settings.coordinators].sort((a,b) => a.name.localeCompare(b.name));
    }, [settings]);

    const filteredNotifications = useMemo(() => {
        let tempNotifications = notifications;

        if (selectedCoordinatorId !== 'all') {
            tempNotifications = tempNotifications.filter(n => n.recipientId === selectedCoordinatorId);
        }
        
        if (employeeNameFilter) {
            tempNotifications = tempNotifications.filter(n => 
                n.entityName.toLowerCase().includes(employeeNameFilter.toLowerCase())
            );
        }

        return tempNotifications;
    }, [notifications, selectedCoordinatorId, employeeNameFilter]);


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
                <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {user.isAdmin && settings && (
                        <div className="space-y-2">
                            <Label>Filtruj wg koordynatora</Label>
                            <Select value={selectedCoordinatorId} onValueChange={setSelectedCoordinatorId}>
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
                    <div className="space-y-2">
                        <Label>Filtruj wg pracownika</Label>
                        <Input 
                            placeholder="Wpisz imię/nazwisko..."
                            value={employeeNameFilter}
                            onChange={(e) => setEmployeeNameFilter(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="h-[calc(100vh-14rem)] pr-6">
                    <div className="space-y-4 py-4">
                    {filteredNotifications.length > 0 ? (
                        filteredNotifications.map((n, index) => <NotificationItem key={n.id} n={n} onClick={onNotificationClick} onDelete={onDeleteNotification} onToggleReadStatus={onToggleNotificationReadStatus} style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }} />)
                    ) : (
                        <div className="text-center text-muted-foreground py-12">Brak powiadomień pasujących do filtrów.</div>
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
