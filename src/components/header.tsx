"use client";

import type { User, View, Notification, Employee } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "@/components/ui/button";
import { Settings, UserCircle, Building, Bell, ArrowRight } from "lucide-react";
import { SidebarTrigger } from "./ui/sidebar";
import { useSidebar } from "./ui/sidebar";
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user: User;
  activeView: View;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
}

const viewTitles: Record<View, string> = {
  dashboard: 'Pulpit',
  employees: 'Pracownicy',
  settings: 'Ustawienia',
  inspections: 'Inspekcje'
}

export default function Header({ user, activeView, notifications, onNotificationClick }: HeaderProps) {
    const { isMobile, open } = useSidebar();
    const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="sticky top-4 z-30 mx-4 flex h-16 items-center gap-4 rounded-2xl bg-card/60 px-4 shadow-lg shadow-orange-400/10 backdrop-blur-xl sm:px-6">
      {!open && <div className="flex items-center gap-2 md:hidden">
        <Building className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">SmartHouse</span>
      </div>
      }
      <div className="flex items-center gap-4">
        {isMobile && <SidebarTrigger />}
        <h1 className="text-xl font-semibold hidden md:block">{viewTitles[activeView]}</h1>
      </div>
      <div className="flex flex-1 items-center justify-end gap-4">
         <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                           {unreadCount > 10 ? '9+' : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Otwórz powiadomienia</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0">
                <div className="p-4">
                  <h4 className="font-medium text-sm">Powiadomienia</h4>
                </div>
                <ScrollArea className="h-96">
                  {notifications.length > 0 ? (
                    notifications.map(notification => (
                       <div key={notification.id} 
                            onClick={() => onNotificationClick(notification)} 
                            className={cn(
                              "border-l-4 p-4 hover:bg-muted/50 cursor-pointer",
                              notification.isRead ? 'border-transparent' : 'border-primary'
                            )}
                       >
                           <p className="text-sm font-medium">{notification.message}</p>
                           {notification.changes && notification.changes.length > 0 && (
                             <div className="mt-2 space-y-1 text-xs">
                                {notification.changes.map((change, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                     <span className="font-semibold">{change.field}:</span>
                                     <span className="text-muted-foreground line-through">{change.oldValue}</span>
                                     <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                     <span className="text-foreground">{change.newValue}</span>
                                  </div>
                                ))}
                             </div>
                           )}
                           <p className="text-xs text-muted-foreground mt-2">
                               {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: pl })}
                           </p>
                       </div>
                    ))
                  ) : (
                    <div className="text-center text-sm text-muted-foreground p-8">
                      Brak nowych powiadomień.
                    </div>
                  )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
