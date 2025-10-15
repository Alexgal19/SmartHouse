
"use client";

import { Home, Users, Settings, ClipboardList } from "lucide-react";
import { Button } from "./ui/button";
import type { View, Coordinator } from "@/types";
import { useRouter } from "@/navigation";
import { useCallback } from "react";

interface MobileNavProps {
  activeView: View;
  navItems: { view: View; icon: React.ElementType; label: string }[];
  currentUser: Coordinator;
}


export function MobileNav({ activeView, navItems, currentUser }: MobileNavProps) {
    const router = useRouter();

    const setActiveView = useCallback((view: View) => {
        router.push({ pathname: '/dashboard', query: { view } });
    }, [router]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] border bg-card/80 backdrop-blur-xl p-2 rounded-2xl shadow-lg shadow-black/10 md:hidden">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto">
        {navItems.map((item) => {
            const isDisabled = item.view === 'settings' && !currentUser.isAdmin;
            return (
              <Button
                key={item.view}
                variant="ghost"
                size="sm"
                disabled={isDisabled}
                className={`flex flex-col h-auto p-2 rounded-xl text-xs ${
                  activeView === item.view
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground"
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => setActiveView(item.view)}
              >
                <item.icon className="h-6 w-6 mb-1" />
                <span>{item.label}</span>
              </Button>
            )
        })}
      </div>
    </div>
  );
}
