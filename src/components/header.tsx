
"use client";

import type { User, View, Notification, Coordinator } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { Button } from "@/components/ui/button";
import { Settings, UserCircle, Building, Bell, ArrowRight, LogOut, Trash2 } from "lucide-react";
import { SidebarTrigger } from "./ui/sidebar";
import { useSidebar } from "./ui/sidebar";
import { formatDistanceToNow } from 'date-fns';
import { pl, uk, enUS, es } from 'date-fns/locale';
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import React from "react";

interface HeaderProps {
  user: User | Coordinator;
  activeView: View;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onLogout: () => void;
  onClearNotifications: () => void;
  languageSwitcher: React.ReactNode;
}

const viewTitles: Record<View, string> = {
  dashboard: 'pulpit',
  employees: 'employees',
  settings: 'settings',
  inspections: 'inspections'
}

const localesMap: Record<string, Locale> = {
    pl,
    uk,
    en: enUS,
    es
}

export default function Header({ user, activeView, notifications, onNotificationClick, onLogout, onClearNotifications, languageSwitcher }: HeaderProps) {
    const { isMobile, open } = useSidebar();
    const t = useTranslations('Header');
    const navT = useTranslations('Navigation');
    const pathname = usePathname();
    const currentLocale = pathname.split('/')[1] as keyof typeof localesMap;
    const locale = localesMap[currentLocale] || pl;

    const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <Building className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">SmartHouse</span>
      </div>
      <div className="flex items-center gap-4 flex-1">
        {isMobile && <SidebarTrigger />}
        <h1 className="text-xl font-semibold hidden md:block">{navT(viewTitles[activeView])}</h1>
      </div>

      <div className="flex items-center justify-end gap-2">
         {languageSwitcher}
         <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                           {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">{t('notifications.open')}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0">
                <div className="p-4 flex items-center justify-between">
                  <h4 className="font-medium text-sm">{t('notifications.title')}</h4>
                  {user.isAdmin && notifications.length > 0 && (
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('notifications.clearAll')}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('notifications.confirmClear.title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('notifications.confirmClear.description')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('notifications.confirmClear.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={onClearNotifications}>{t('notifications.confirmClear.confirm')}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
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
                               {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale })}
                           </p>
                       </div>
                    ))
                  ) : (
                    <div className="text-center text-sm text-muted-foreground p-8">
                      {t('notifications.noNew')}
                    </div>
                  )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
         <Button variant="ghost" size="icon" onClick={onLogout}>
            <LogOut className="h-5 w-5" />
            <span className="sr-only">{t('logout')}</span>
        </Button>
      </div>
    </header>
  );
}
