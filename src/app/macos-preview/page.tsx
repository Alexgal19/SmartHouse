"use client";

import React from 'react';

export default function DarkGlowPreviewPage() {
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    .font-inter { font-family: 'Inter', sans-serif; }
  `;

  return (
    <div className="min-h-screen flex flex-col font-inter bg-[#303030] relative overflow-hidden text-white">
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      
      {/* Background Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-[#d97253]/30 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* Top Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF5722] flex items-center justify-center shadow-lg shadow-[#FF5722]/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span className="font-bold text-xl tracking-tight">SmartHouse</span>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <span className="text-white relative">
              Dashboard
              <span className="absolute -bottom-6 left-0 w-full h-[2px] bg-[#FF5722]"></span>
            </span>
            <span className="hover:text-white cursor-pointer transition-colors">Osoby</span>
            <span className="hover:text-white cursor-pointer transition-colors">Karty</span>
            <span className="hover:text-white cursor-pointer transition-colors">Więcej</span>
          </div>
        </div>

        {/* User */}
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold border border-white/5 cursor-pointer hover:bg-white/20 transition-colors shrink-0">
          AK
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col pt-6 md:pt-12">
        <div className="px-4 md:px-8 max-w-[1400px] w-full mx-auto">
          {/* Header */}
          <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-400 mb-1">System zakwaterowania</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
            </div>
            <div className="flex gap-2 md:gap-3 flex-wrap">
              <div className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs md:text-sm font-medium">
                Online <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="bg-[#61362e] border border-[#FF5722]/30 px-3 py-1.5 rounded-full flex items-center text-[#ffccbc] text-xs md:text-sm font-medium">
                247 osób
              </div>
            </div>
          </header>

          {/* KPI Cards Row - 2x2 on mobile, 4x1 on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-12">
            {/* Card 1 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[20px] p-4 md:p-6 hover:bg-white/10 transition-colors cursor-pointer backdrop-blur-md">
              <p className="text-xs md:text-sm text-gray-400 font-medium mb-2 md:mb-4">Zakwaterowanych</p>
              <p className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">247</p>
              <p className="text-[10px] md:text-xs text-gray-500">+12%</p>
            </div>

            {/* Card 2 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[20px] p-4 md:p-6 hover:bg-white/10 transition-colors cursor-pointer backdrop-blur-md">
              <p className="text-xs md:text-sm text-gray-400 font-medium mb-2 md:mb-4">Nowe dzisiaj</p>
              <p className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">18</p>
              <p className="text-[10px] md:text-xs text-gray-500">Oczekuje</p>
            </div>

            {/* Card 3 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[20px] p-4 md:p-6 hover:bg-white/10 transition-colors cursor-pointer backdrop-blur-md">
              <p className="text-xs md:text-sm text-gray-400 font-medium mb-2 md:mb-4">Karty</p>
              <p className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">34</p>
              <p className="text-[10px] md:text-xs text-gray-500">Do zrobienia</p>
            </div>

            {/* Card 4 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[20px] p-4 md:p-6 hover:bg-white/10 transition-colors cursor-pointer backdrop-blur-md">
              <p className="text-xs md:text-sm text-gray-400 font-medium mb-2 md:mb-4">Obsadzenie</p>
              <p className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">91%</p>
              <p className="text-[10px] md:text-xs text-gray-500">295/324</p>
            </div>
          </div>
        </div>

        {/* Bottom White Container */}
        <div className="mt-auto bg-white rounded-t-[24px] md:rounded-t-[32px] flex-1 text-black shadow-[0_-20px_40px_rgba(0,0,0,0.1)]">
          <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100">
            <h2 className="text-lg md:text-xl font-bold">Widok systemu</h2>
            <div className="w-full lg:w-auto overflow-x-auto hide-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
              <div className="flex bg-gray-50/80 p-1 rounded-xl border border-gray-100 shadow-sm w-max">
                <button className="px-4 md:px-6 py-2 rounded-lg bg-white shadow-sm font-semibold text-[#FF5722] text-xs md:text-sm whitespace-nowrap">Przegląd</button>
                <button className="px-4 md:px-6 py-2 rounded-lg text-gray-500 font-medium text-xs md:text-sm hover:text-black transition-colors whitespace-nowrap">Osoby</button>
                <button className="px-4 md:px-6 py-2 rounded-lg text-gray-500 font-medium text-xs md:text-sm hover:text-black transition-colors whitespace-nowrap">Statystyki</button>
              </div>
            </div>
          </div>
          <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 py-8 md:py-12">
            <div className="w-full h-48 md:h-64 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 text-sm md:text-base text-center p-4">
               Na urządzeniach mobilnych panel przewija się pod spodem.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
