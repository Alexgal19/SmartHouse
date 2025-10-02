"use client";

import type { User, View } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, UserCircle } from "lucide-react";
import { SidebarTrigger } from "./ui/sidebar";
import { useSidebar } from "./ui/sidebar";

interface HeaderProps {
  user: User;
  activeView: View;
}

const viewTitles: Record<View, string> = {
  dashboard: 'Pulpit',
  employees: 'Pracownicy',
  settings: 'Ustawienia',
  inspections: 'Inspekcje'
}

export default function Header({ user, activeView }: HeaderProps) {
    const { isMobile } = useSidebar();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
      {isMobile && <SidebarTrigger />}
      <h1 className="text-xl font-semibold">{viewTitles[activeView]}</h1>
      <div className="relative ml-auto flex-1 md:grow-0">
        {/* Search could go here if needed */}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
            <Avatar>
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <UserCircle className="mr-2 h-4 w-4" />
            <span>Profil</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Ustawienia</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Wyloguj</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
