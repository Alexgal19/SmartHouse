"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ModernHouseIcon } from '@/components/icons/modern-house-icon';

type Theme = 'fintech' | 'macos' | 'realestate';

export default function ProfessionalDesignPreview() {
  const [theme, setTheme] = useState<Theme>('fintech');

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Cormorant+Garamond:wght@600;700&display=swap');
    
    .font-manrope { font-family: 'Manrope', sans-serif; }
    .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-serif-lux { font-family: 'Cormorant Garamond', serif; }
    
    /* Fine-tuned shadows for professional look */
    .shadow-fintech { box-shadow: 0 4px 24px -6px rgba(0,0,0,0.05), 0 0 1px 0 rgba(0,0,0,0.1); }
    .shadow-macos { box-shadow: 0 8px 32px -4px rgba(0,0,0,0.1), 0 0 1px 0 rgba(0,0,0,0.15); }
    .shadow-lux { box-shadow: 0 12px 40px -10px rgba(0, 0, 0, 0.15); }
  `;

  return (
    <div className="min-h-screen overflow-hidden flex flex-col relative bg-[#f8f9fa]">
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

      {/* Selector */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl border shadow-sm w-max">
        <Button variant={theme === 'fintech' ? 'default' : 'ghost'} className="rounded-lg font-manrope text-sm px-6" onClick={() => setTheme('fintech')}>1. Enterprise FinTech</Button>
        <Button variant={theme === 'macos' ? 'default' : 'ghost'} className="rounded-lg font-jakarta text-sm px-6" onClick={() => setTheme('macos')}>2. macOS Pro Glass</Button>
        <Button variant={theme === 'realestate' ? 'default' : 'ghost'} className="rounded-lg font-jakarta text-sm px-6" onClick={() => setTheme('realestate')}>3. Premium Real Estate</Button>
      </div>

      {/* Dynamic Content */}
      <div className={cn("flex-1 transition-all duration-700 w-full h-full p-4 pt-24", 
        theme === 'fintech' && 'bg-[#FAFAFA]',
        theme === 'macos' && 'bg-[url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")] bg-cover bg-center',
        theme === 'realestate' && 'bg-[#1C2321]'
      )}>
        {theme === 'macos' && <div className="absolute inset-0 bg-white/40 backdrop-blur-[60px] z-0"></div>}
        
        <div className="max-w-6xl mx-auto h-full flex flex-col relative z-10">
          
          {/* 1. Enterprise FinTech */}
          {theme === 'fintech' && (
            <div className="font-manrope text-[#111827] animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
              <header className="mb-10 flex justify-between items-center border-b border-gray-200 pb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">System Operacyjny</span>
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight">SmartHouse Admin</h1>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-500">Witaj, A. Kowalski</span>
                  <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-sm">AK</div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 grid grid-cols-3 gap-6">
                  {/* KPI Card */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-fintech hover:border-gray-300 transition-colors">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Aktywni Mieszkańcy</p>
                    <p className="text-4xl font-extrabold tracking-tight mb-2">247</p>
                    <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                      <span>↑ +12%</span> <span className="text-gray-400 font-normal">vs zeszły miesiąc</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-fintech hover:border-gray-300 transition-colors">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Wolne Łóżka</p>
                    <p className="text-4xl font-extrabold tracking-tight mb-2 text-orange-600">77</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                      <span>Na 324 całkowitych</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-fintech hover:border-gray-300 transition-colors">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Oczekujące Akcje</p>
                    <p className="text-4xl font-extrabold tracking-tight mb-2">34</p>
                    <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                      <span>Karty kontrolne do weryfikacji</span>
                    </div>
                  </div>

                  {/* Main Graph Area */}
                  <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-fintech p-6 h-72 flex flex-col justify-between">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                       <h3 className="font-bold">Dynamika zakwaterowań</h3>
                       <button className="text-sm text-gray-500 hover:text-black font-medium transition-colors">Ostatnie 7 dni ↓</button>
                    </div>
                    <div className="flex-1 flex items-end justify-between px-4">
                       {[40, 70, 45, 90, 65, 100, 80].map((h, i) => (
                         <div key={i} className="w-12 bg-gray-100 hover:bg-gray-200 rounded-t-md transition-colors relative group">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {h}
                            </div>
                            <div className="w-full bg-gray-900 rounded-t-md" style={{height: `${h}%`}}></div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Right Sidebar */}
                <div className="md:col-span-1 bg-gray-900 rounded-xl p-6 text-white flex flex-col shadow-fintech">
                  <h3 className="font-bold text-lg mb-6">Szybkie operacje</h3>
                  <button className="w-full bg-white text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors mb-4 flex items-center justify-center gap-2">
                    <span>+</span> Dodaj Mieszkańca
                  </button>
                  <button className="w-full bg-gray-800 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700">
                    Skanuj Paszport AI
                  </button>
                  
                  <div className="mt-auto">
                    <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mb-2">Status Systemu</p>
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                       <span className="text-sm text-gray-300">Wszystkie usługi aktywne</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. macOS Pro Glass */}
          {theme === 'macos' && (
            <div className="font-jakarta text-gray-800 animate-in fade-in duration-500 w-full pt-4">
              <header className="mb-8 px-2 flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                <div className="w-8 h-8 rounded-full bg-white/60 shadow-sm border border-white/40 flex items-center justify-center text-xs font-bold text-gray-700">AK</div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-macos rounded-2xl p-6 hover:bg-white/60 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-600">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Zakwaterowani</p>
                  <p className="text-5xl font-semibold mt-1">247</p>
                </div>

                <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-macos rounded-2xl p-6 hover:bg-white/60 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 text-orange-600">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Wolne Miejsca</p>
                  <p className="text-5xl font-semibold mt-1">77</p>
                </div>

                <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-macos rounded-2xl p-6 hover:bg-white/60 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-600">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Karty do weryfikacji</p>
                  <p className="text-5xl font-semibold mt-1">34</p>
                </div>

                <div className="md:col-span-3 bg-white/50 backdrop-blur-2xl border border-white/60 shadow-macos rounded-2xl p-8 mt-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Zarządzanie Osobami</h2>
                    <p className="text-gray-500 text-sm">Dodaj nowego mieszkańca lub zaktualizuj dane w oparciu o AI.</p>
                  </div>
                  <div className="flex gap-3">
                    <button className="bg-white/80 hover:bg-white text-gray-800 border border-gray-200/50 shadow-sm px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                      Skanuj Dokument
                    </button>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                      + Dodaj Ręcznie
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Premium Real Estate */}
          {theme === 'realestate' && (
            <div className="font-jakarta text-[#D8D4CF] animate-in fade-in duration-500 w-full pt-8">
              <header className="mb-14 border-b border-[#D8D4CF]/20 pb-8 flex justify-between items-end">
                <div>
                  <p className="text-[#B99A73] text-sm uppercase tracking-[0.2em] mb-2 font-semibold">Panel Zarządcy</p>
                  <h1 className="text-5xl font-serif-lux text-white">SmartHouse Portfolio</h1>
                </div>
                <div className="text-right">
                  <div className="w-12 h-12 rounded-full border border-[#B99A73] text-[#B99A73] flex items-center justify-center font-serif-lux text-xl italic mb-2 ml-auto">AK</div>
                  <p className="text-xs opacity-60 tracking-wider">Property Manager</p>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8 grid grid-cols-2 gap-8">
                  <div className="bg-[#2A3431] p-8 rounded-sm border-l-4 border-[#B99A73] shadow-lux hover:bg-[#2F3A37] transition-colors cursor-pointer">
                    <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-6">Zakwaterowani Mieszkańcy</h3>
                    <p className="text-6xl font-serif-lux text-white mb-2">247</p>
                    <p className="text-[#B99A73] text-sm">Stan na dziś</p>
                  </div>

                  <div className="bg-[#2A3431] p-8 rounded-sm shadow-lux hover:bg-[#2F3A37] transition-colors cursor-pointer relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 text-[#B99A73]/20">
                      <ModernHouseIcon className="w-24 h-24" />
                    </div>
                    <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-6 relative z-10">Wolne Pokoje/Łóżka</h3>
                    <p className="text-6xl font-serif-lux text-white mb-2 relative z-10">77</p>
                    <p className="text-gray-400 text-sm relative z-10">Pula całkowita: 324</p>
                  </div>

                  <div className="col-span-2 bg-[#2A3431] p-8 rounded-sm shadow-lux mt-2">
                    <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-6">Karty do autoryzacji</h3>
                    <div className="flex items-center justify-between">
                       <div className="flex items-end gap-4">
                         <p className="text-5xl font-serif-lux text-white">34</p>
                         <p className="text-gray-400 pb-2">Dokumentów oczekuje</p>
                       </div>
                       <button className="border border-[#B99A73] text-[#B99A73] hover:bg-[#B99A73] hover:text-[#1C2321] transition-colors px-8 py-3 uppercase tracking-wider text-xs font-bold">
                         Rozpocznij Audyt
                       </button>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-4 bg-[#B99A73] rounded-sm p-8 text-[#1C2321] flex flex-col justify-center items-center text-center shadow-lux">
                  <h3 className="font-serif-lux text-3xl mb-4 text-[#1C2321]">Rejestracja</h3>
                  <p className="text-sm opacity-80 mb-8 max-w-[250px]">Zeskanuj dokument za pomocą sztucznej inteligencji, aby błyskawicznie wprowadzić dane nowego rezydenta.</p>
                  
                  <button className="bg-[#1C2321] text-white w-full py-4 uppercase tracking-widest text-xs font-bold hover:bg-[#2A3431] transition-colors mb-4">
                    Skanuj Paszport AI
                  </button>
                  <button className="border border-[#1C2321] text-[#1C2321] w-full py-4 uppercase tracking-widest text-xs font-bold hover:bg-[#1C2321]/5 transition-colors">
                    Wprowadź Ręcznie
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
