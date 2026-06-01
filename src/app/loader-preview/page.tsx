"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import './loader.css';

const housePath = "M10 50 L50 10 L90 50 L90 90 L65 90 L65 65 L35 65 L35 90 L10 90 Z";

const LoaderNeon = () => (
  <div className="flex flex-col items-center justify-center gap-8">
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(255,87,34,0.8)]">
         <path d={housePath} fill="transparent" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-neon-trace" />
      </svg>
    </div>
    <p className="text-sm font-medium tracking-widest uppercase text-primary animate-pulse">Wczytywanie danych...</p>
  </div>
);

const LoaderGlassFill = () => (
  <div className="flex flex-col items-center justify-center gap-8">
    <div className="relative w-36 h-36 rounded-full bg-white/30 dark:bg-white/5 backdrop-blur-xl shadow-2xl border border-white/40 flex items-center justify-center animate-floating">
      <svg viewBox="0 0 100 100" className="w-16 h-16">
         <defs>
            <clipPath id="houseClip">
              <path d={housePath} />
            </clipPath>
         </defs>
         <path d={housePath} fill="currentColor" className="text-gray-400/20" />
         <g clipPath="url(#houseClip)">
            <rect x="0" y="0" width="100" height="100" fill="hsl(var(--primary))" className="animate-liquid-fill" />
         </g>
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-500">Wczytywanie danych...</p>
  </div>
);

const LoaderShimmer = () => {
    return (
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
             <path d={housePath} fill="currentColor" className="text-white/40 dark:text-white/10" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          </svg>
          <div className="absolute inset-0 overflow-hidden loader-shimmer-mask">
             <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-90 animate-shimmer-glass"></div>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-500">Wczytywanie danych...</p>
      </div>
    );
};

const LoaderPulse = () => (
  <div className="flex flex-col items-center justify-center gap-8">
    <div className="relative w-32 h-32 flex items-center justify-center animate-pulse-scale">
      <svg viewBox="0 0 100 100" className="w-full h-full text-primary">
         <path d={housePath} fill="currentColor" />
      </svg>
    </div>
    <p className="text-sm font-bold text-primary opacity-80 animate-pulse-scale">Wczytywanie danych...</p>
  </div>
);

export default function LoaderPreviewPage() {
  const [selected, setSelected] = useState<number>(1);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-black dark:to-gray-900 flex flex-col items-center justify-center p-4">
      
      <div className="fixed top-8 left-1/2 -translate-x-1/2 flex gap-3 flex-wrap justify-center w-full max-w-3xl z-50">
         {[1, 2, 3, 4].map(num => (
           <Button key={num} variant={selected === num ? 'default' : 'outline'} className="rounded-full px-6 bg-white/50 dark:bg-black/50 backdrop-blur" onClick={() => setSelected(num)}>
             {num === 1 ? '1. Neon Trace' : num === 2 ? '2. Floating Glass Fill' : num === 3 ? '3. Shimmer Glass' : '4. Pulse & Glow'}
           </Button>
         ))}
      </div>

      <div className="w-full max-w-lg h-[500px] bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl flex items-center justify-center">
         {selected === 1 && <LoaderNeon />}
         {selected === 2 && <LoaderGlassFill />}
         {selected === 3 && <LoaderShimmer />}
         {selected === 4 && <LoaderPulse />}
      </div>
    </div>
  );
}
