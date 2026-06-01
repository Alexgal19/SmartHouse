"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModernHouseIcon } from '@/components/icons/modern-house-icon';
import { Bell, Search, Plus, User, FileText, BarChart2, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

type ThemeOption = 'current' | 'glassmorphism' | 'neon' | 'obsidian';

export default function DesignPreviewPage() {
  const [theme, setTheme] = useState<ThemeOption>('glassmorphism');

  // --- Theme Styles Mapping ---
  const themeStyles = {
    current: {
      wrapper: "bg-[#f4f4f5] min-h-screen",
      header: "bg-[#3a3535] text-white",
      statsCard: "bg-[#4b4545] border-transparent text-white",
      mainCard: "bg-white border-gray-200 text-black",
      primaryBtn: "bg-[#ff5722] hover:bg-[#e64a19] text-white",
      accentText: "text-[#ff5722]",
    },
    glassmorphism: {
      wrapper: "bg-gradient-to-br from-gray-100 to-gray-200 min-h-screen",
      header: "bg-white/40 backdrop-blur-xl border-b border-white/50 text-gray-900 shadow-sm",
      statsCard: "bg-white/50 backdrop-blur-md border border-white/60 shadow-lg text-gray-900 transition-all hover:-translate-y-1 hover:shadow-xl",
      mainCard: "bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl text-gray-900 rounded-2xl",
      primaryBtn: "bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white shadow-md shadow-orange-500/20 transition-all active:scale-95",
      accentText: "text-orange-500",
    },
    neon: {
      wrapper: "bg-[#09090b] min-h-screen text-white",
      header: "bg-black/50 backdrop-blur-lg border-b border-white/10 text-white",
      statsCard: "bg-[#18181b] border border-white/5 shadow-[0_0_15px_rgba(255,87,34,0.1)] hover:shadow-[0_0_25px_rgba(255,87,34,0.3)] text-white transition-all relative overflow-hidden group",
      mainCard: "bg-[#18181b] border border-white/10 shadow-2xl text-white rounded-xl",
      primaryBtn: "bg-[#ff5722] hover:bg-[#ff7043] text-white shadow-[0_0_15px_rgba(255,87,34,0.5)] transition-all active:scale-95",
      accentText: "text-[#ff5722]",
    },
    obsidian: {
      wrapper: "bg-[#0a0a0c] min-h-screen text-gray-100",
      header: "bg-[#121214] border-b border-[#27272a] text-gray-100",
      statsCard: "bg-gradient-to-b from-[#1c1c1f] to-[#121214] border border-[#27272a] text-gray-100 shadow-md hover:border-gray-500 transition-colors rounded-xl",
      mainCard: "bg-[#121214] border border-[#27272a] text-gray-100 shadow-2xl rounded-xl",
      primaryBtn: "bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white transition-all active:scale-95",
      accentText: "text-gray-300",
    }
  };

  const current = themeStyles[theme];

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans">
      {/* 1. Theme Selector Panel (Sticky Top) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white/90 dark:bg-black/90 backdrop-blur-md p-2 rounded-full border shadow-2xl flex gap-2 overflow-x-auto w-[90%] md:w-auto max-w-full">
        {(['current', 'glassmorphism', 'neon', 'obsidian'] as ThemeOption[]).map((t) => (
          <Button
            key={t}
            variant={theme === t ? 'default' : 'outline'}
            className="rounded-full px-6 capitalize flex-shrink-0"
            onClick={() => setTheme(t)}
          >
            {t === 'current' ? 'Obecny (Baza)' : t}
          </Button>
        ))}
      </div>

      <div className={cn("flex-1 overflow-y-auto pb-24 transition-colors duration-500", current.wrapper)}>
        
        {/* HEADER */}
        <header className={cn("px-4 md:px-8 py-4 flex items-center justify-between transition-colors duration-500", current.header)}>
          <div className="flex items-center gap-3">
            <ModernHouseIcon className={cn("w-8 h-8", current.accentText)} />
            <h1 className="text-xl font-bold tracking-tight hidden md:block">SmartHouse</h1>
          </div>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-6 items-center font-medium text-sm">
            <a href="#" className={cn("pb-1 border-b-2", theme === 'current' ? "border-orange-500 text-white" : "border-current")}>Dashboard</a>
            <a href="#" className="opacity-70 hover:opacity-100 transition-opacity">Osoby</a>
            <a href="#" className="opacity-70 hover:opacity-100 transition-opacity">Karty</a>
            <a href="#" className="opacity-70 hover:opacity-100 transition-opacity">Więcej</a>
          </nav>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell className="w-5 h-5 opacity-80" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center font-bold text-sm">
              AK
            </div>
            {/* Mobile Menu Icon */}
            <Menu className="w-6 h-6 md:hidden opacity-80" />
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 mt-4">
          
          {/* Page Title */}
          <div>
            <p className="text-sm opacity-60 font-medium mb-1 uppercase tracking-wider">System zakwaterowania</p>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-4xl font-extrabold tracking-tight">Dashboard</h2>
              <div className="flex gap-2">
                <div className={cn("px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border", theme === 'current' ? "bg-[#4b4545] border-transparent text-white" : "bg-black/10 border-black/10 dark:bg-white/10 dark:border-white/10")}>
                  Online <span className="w-2 h-2 rounded-full bg-green-500"></span>
                </div>
                <div className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border", theme === 'current' ? "bg-[#ff5722]/20 border-transparent text-[#ff5722]" : "bg-orange-500/20 text-orange-500 border-orange-500/20")}>
                  247 osób
                </div>
              </div>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { title: "Zakwaterowanych", value: "247", sub: "+12%" },
              { title: "Nowe dzisiaj", value: "18", sub: "Oczekuje", highlight: true },
              { title: "Karty kontrolne", value: "34", sub: "Do zrobienia" },
              { title: "Obsadzenie", value: "91%", sub: "295/324" }
            ].map((kpi, i) => (
              <div key={i} className={cn("p-6 rounded-2xl relative", current.statsCard)}>
                {theme === 'neon' && kpi.highlight && (
                   <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-pink-500/20 blur-xl -z-10 animate-pulse"></div>
                )}
                <p className="text-sm opacity-70 font-medium mb-2">{kpi.title}</p>
                <p className="text-4xl font-bold mb-2 tracking-tighter">{kpi.value}</p>
                <p className="text-xs opacity-60 font-medium">{kpi.sub}</p>
                {theme === 'glassmorphism' && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -z-10"></div>
                )}
              </div>
            ))}
          </div>

          {/* Main Chart / List Section */}
          <div className={cn("p-6 md:p-8 mt-8", current.mainCard)}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h3 className="text-xl font-bold">Widok systemu</h3>
              <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-lg">
                <button className="px-4 py-1.5 bg-white dark:bg-black rounded-md shadow-sm text-sm font-semibold text-orange-500">Przegląd</button>
                <button className="px-4 py-1.5 text-sm font-medium opacity-70 hover:opacity-100">Osoby</button>
                <button className="px-4 py-1.5 text-sm font-medium opacity-70 hover:opacity-100">Statystyki</button>
              </div>
            </div>
            
            {/* Mock Chart Area */}
            <div className="h-48 border-b border-dashed border-gray-300 dark:border-gray-700 flex items-end justify-around pb-4 relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="opacity-40 text-sm font-medium">Zgłoszenia w tym tygodniu</p>
              </div>
              {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={cn("w-8 md:w-12 rounded-t-sm", current.primaryBtn)} style={{ height: `${Math.max(20, Math.random() * 100)}px`, opacity: 0.8 }}></div>
                  <span className="text-xs opacity-50 font-medium">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action Area */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
             <h3 className="text-2xl font-bold">Osoby</h3>
             <button className={cn("px-6 py-2.5 rounded-full font-bold flex items-center gap-2 w-full md:w-auto justify-center", current.primaryBtn)}>
               <Plus className="w-5 h-5" /> Dodaj nową
             </button>
          </div>

        </main>
      </div>
    </div>
  );
}
