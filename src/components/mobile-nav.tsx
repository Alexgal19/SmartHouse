
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { View, SessionData } from "@/types";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { MoreHorizontal, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const MAX_BAR_ITEMS = 5;

export function MobileNav({
    activeView,
    navItems,
    currentUser
}: {
    activeView: View;
    navItems: { view: View; icon: React.ElementType; label: string }[];
    currentUser: SessionData;
}) {
    const { t } = useLanguage();
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [unacceptedCount, setUnacceptedCount] = useState(0);

    useEffect(() => {
        if (!currentUser) return;
        const load = async () => {
            try {
                const res = await fetch('/api/odbior/zgloszenia');
                if (!res.ok) return;
                const data = await res.json();
                setUnacceptedCount(data.filter((z: { status: string }) => z.status === 'Nieprzyjęte').length);
            } catch {
                // ignore
            }
        };
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, [currentUser]);

    const filteredItems = navItems.filter(item => {
        if ((item.view === 'settings' || item.view === 'recruitment') && !currentUser?.isAdmin) {
            return false;
        }
        return true;
    });

    const needsMore = filteredItems.length > MAX_BAR_ITEMS;
    const barItems = needsMore ? filteredItems.slice(0, MAX_BAR_ITEMS - 1) : filteredItems;
    const moreItems = needsMore ? filteredItems.slice(MAX_BAR_ITEMS - 1) : [];

    const isMoreActive = moreItems.some(item => item.view === activeView);

    const NavItem = ({ item, onClick }: { item: typeof barItems[0]; onClick?: () => void }) => (
        <Link
            href={`/dashboard?view=${item.view}`}
            onClick={onClick}
            className={cn(
                "flex flex-1 flex-col items-center justify-center h-full min-w-0",
                activeView === item.view
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
            )}
        >
            <div className={cn(
                "relative flex items-center justify-center p-2 rounded-lg",
                activeView === item.view && "bg-primary/10"
            )}>
                <item.icon className="h-5 w-5" />
                {item.view === 'odbior' && unacceptedCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {unacceptedCount > 9 ? '9+' : unacceptedCount}
                    </span>
                )}
            </div>
            <span className="truncate text-center w-full px-1">{item.label}</span>
        </Link>
    );

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm sm:hidden shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.1)]">
            <div className="flex h-16 items-center text-xs">
                {barItems.map(item => (
                    <NavItem key={item.view} item={item} />
                ))}
                {needsMore && (
                    <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
                        <SheetTrigger asChild>
                            <button
                                className={cn(
                                    "flex flex-1 flex-col items-center justify-center h-full min-w-0",
                                    isMoreActive
                                        ? "font-semibold text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                <div className={cn(
                                    "flex items-center justify-center p-2 rounded-lg",
                                    isMoreActive && "bg-primary/10"
                                )}>
                                    <MoreHorizontal className="h-5 w-5" />
                                </div>
                                <span className="truncate text-center w-full px-1">{t('nav.more')}</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-xl pb-8">
                            <SheetHeader className="sr-only">
                                <SheetTitle>{t('nav.more')}</SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-1 mt-2">
                                {moreItems.map(item => (
                                    <SheetClose asChild key={item.view}>
                                        <Link
                                            href={`/dashboard?view=${item.view}`}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors",
                                                activeView === item.view
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-foreground hover:bg-muted"
                                            )}
                                        >
                                            <div className="relative">
                                                <item.icon className="h-5 w-5 shrink-0" />
                                                {item.view === 'odbior' && unacceptedCount > 0 && (
                                                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                                                        {unacceptedCount > 9 ? '9+' : unacceptedCount}
                                                    </span>
                                                )}
                                            </div>
                                            <span>{item.label}</span>
                                        </Link>
                                    </SheetClose>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                )}
            </div>
        </div>
    );
}
