"use client";

import { Home, Users, Settings, ClipboardList } from "lucide-react";
import { Button } from "./ui/button";
import type { View } from "@/types";

interface MobileNavProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const navItems: { view: View; icon: React.ElementType; label: string }[] = [
  { view: 'dashboard', icon: Home, label: 'Pulpit' },
  { view: 'employees', icon: Users, label: 'Pracownicy' },
  { view: 'inspections', icon: ClipboardList, label: 'Inspekcje' },
  { view: 'settings', icon: Settings, label: 'Ustawienia' },
];

export function MobileNav({ activeView, setActiveView }: MobileNavProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] border bg-card/60 backdrop-blur-xl p-2 rounded-2xl shadow-lg shadow-black/10 lg:hidden">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto">
        {navItems.map((item) => (
          <Button
            key={item.view}
            variant="ghost"
            size="sm"
            className={`flex flex-col h-auto p-1 rounded-full ${
              activeView === item.view
                ? "text-primary bg-primary/10"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveView(item.view)}
          >
            <item.icon className="h-6 w-6 mb-1" />
            <span className="text-xs font-medium">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
