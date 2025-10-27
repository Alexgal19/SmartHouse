
"use client";

import Link from "next/link"
import { ClipboardList, Home, Users, Settings, Archive } from "lucide-react"
import type { View, SessionData } from "@/types"
import { cn } from "@/lib/utils"

export function MobileNav({ 
    activeView, 
    navItems,
    currentUser
}: { 
    activeView: View; 
    navItems: { view: View; icon: React.ElementType; label: string }[];
    currentUser: SessionData;
}) {
    
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm sm:hidden shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.1)]">
      <div className="grid h-16 grid-cols-5 items-center justify-center text-xs">
        {navItems.map((item) => {
          if (item.view === 'settings' && !currentUser?.isAdmin) {
            return null;
          }
          return (
            <Link
              key={item.view}
              href={`/dashboard?view=${item.view}`}
              className={cn(
                "flex flex-col items-center gap-1 p-2",
                activeView === item.view
                  ? "font-semibold text-primary"
                  : "text-muted-foreground",
                 (item.view === 'settings' && !currentUser?.isAdmin) ? "pointer-events-none opacity-50" : ""
              )}
            >
              <div className={cn(
                  "flex items-center justify-center p-2 rounded-lg",
                  activeView === item.view && "bg-primary/10"
              )}>
                <item.icon className="h-5 w-5" />
              </div>
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

  