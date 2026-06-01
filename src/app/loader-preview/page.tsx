"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

const housePath = "M10 50 L50 10 L90 50 L90 90 L65 90 L65 65 L35 65 L35 90 L10 90 Z";

const LoaderNeon = () => (
  <div className="flex flex-col items-center justify-center gap-8">
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(255,87,34,0.8)]">
         <path d={housePath} fill="transparent" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'neon-trace 3s linear infinite' }} />
      </svg>
    </div>
    <p className="text-sm font-medium tracking-widest uppercase text-primary animate-pulse">Wczytywanie danych...</p>
  </div>
);

const LoaderGlassFill = () => (
  <div className="flex flex-col items-center justify-center gap-8">
    <div className="relative w-36 h-36 rounded-full bg-white/30 dark:bg-white/5 backdrop-blur-xl shadow-2xl border border-white/40 flex items-center justify-center" style={{ animation: 'floating 3s ease-in-out infinite' }}>
      <svg viewBox="0 0 100 100" className="w-16 h-16">
         <defs>
           <clipPath id="houseClip">
             <path d={housePath} />
           </clipPath>
         </defs>
         <path d={housePath} fill="currentColor" className="text-gray-400/20" />
         <g clipPath="url(#houseClip)">
            <rect x="0" y="0" width="100" height="100" fill="hsl(var(--primary))" style={{ transformOrigin: 'bottom', animation: 'liquid-fill 2s ease-in-out infinite alternate' }} />
         </g>
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-500">Wczytywanie danych...</p>
  </div>
);

const LoaderShimmer = () => {
    // For mask we use data URI of the house SVG
    const svgMask = `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 50 L50 10 L90 50 L90 90 L65 90 L65 65 L35 65 L35 90 L10 90 Z' fill='white'/%3E%3C/svg%3E")`;
    return (
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
             <path d={housePath} fill="currentColor" className="text-white/40 dark:text-white/10" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          </svg>
          <div className="absolute inset-0 overflow-hidden" style={{ maskImage: svgMask, WebkitMaskImage: svgMask }}>
             <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-90" style={{ animation: 'shimmer-glass 2.5s infinite' }}></div>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-500">Wczytywanie danych...</p>
      </div>
    );
};

const LoaderPulse = () => (
  <div className="flex flex-col items-center justify-center gap-8">
    <div className="relative w-32 h-32 flex items-center justify-center" style={{ animation: 'pulse-scale 2s ease-in-out infinite' }}>
      <svg viewBox="0 0 100 100" className="w-full h-full text-primary">
         <path d={housePath} fill="currentColor" />
      </svg>
    </div>
    <p className="text-sm font-bold text-primary opacity-80" style={{ animation: 'pulse-scale 2s ease-in-out infinite' }}>Wczytywanie danych...</p>
  </div>
);

export default function LoaderPreviewPage() {
  const [selected, setSelected] = useState<number>(1);
  
  const style = `
    @keyframes neon-trace {
      0% { stroke-dasharray: 0, 400; stroke-dashoffset: 0; }
      50% { stroke-dasharray: 400, 0; stroke-dashoffset: 0; }
      100% { stroke-dasharray: 0, 400; stroke-dashoffset: -400; }
    }
    @keyframes shimmer-glass {
      0% { transform: translateX(-150%) skewX(-15deg); }
      100% { transform: translateX(250%) skewX(-15deg); }
    }
    @keyframes floating {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }
    @keyframes pulse-scale {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(255,87,34,0.2)); }
      50% { transform: scale(1.08); filter: drop-shadow(0 0 25px rgba(255,87,34,0.7)); }
    }
    @keyframes liquid-fill {
      0% { transform: translateY(100%); }
      100% { transform: translateY(0); }
    }
  `;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-black dark:to-gray-900 flex flex-col items-center justify-center p-4">
      <style>{style}</style>
      
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
