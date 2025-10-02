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
    <div className="fixed bottom-0 left-0 z-40 w-full border-t bg-card p-2 lg:hidden">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto">
        {navItems.map((item) => (
          <Button
            key={item.view}
            variant="ghost"
            size="sm"
            className={`flex flex-col h-auto p-1 ${
              activeView === item.view
                ? "text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveView(item.view)}
          >
            <item.icon className="h-6 w-6 mb-1" />
            <span className="text-xs">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
