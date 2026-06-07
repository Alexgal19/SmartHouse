"use client";

import { useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function useViewPersistence(viewKey: string) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isRestored = useRef(false);

    // 1. Restore and save URL query parameters (filters, view modes)
    useEffect(() => {
        if (typeof window === 'undefined' || !window.sessionStorage) return;

        const currentQueryString = searchParams.toString();
        
        if (!isRestored.current) {
            isRestored.current = true;
            const savedQueryString = sessionStorage.getItem(`viewState_${viewKey}`);
            
            if (!currentQueryString && savedQueryString) {
                router.replace(`${pathname}?${savedQueryString}`, { scroll: false });
                return;
            }
        }
        
        sessionStorage.setItem(`viewState_${viewKey}`, currentQueryString);
    }, [searchParams, viewKey, pathname, router]);

    // 2. Restore and save scroll positions
    useEffect(() => {
        if (typeof window === 'undefined' || !window.sessionStorage) return;

        // Window scroll listener
        const handleWindowScroll = () => {
            sessionStorage.setItem(`windowScroll_${viewKey}`, window.scrollY.toString());
        };
        window.addEventListener('scroll', handleWindowScroll, { passive: true });

        // ScrollArea scroll listener
        let scrollAreaViewport: Element | null = null;
        const handleAreaScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            sessionStorage.setItem(`areaScroll_${viewKey}`, target.scrollTop.toString());
        };

        const attachScrollArea = () => {
            // Find viewport inside the ScrollArea component by the custom id
            const newViewport = document.querySelector(`#scroll-area-${viewKey} [data-radix-scroll-area-viewport]`);
            if (newViewport && newViewport !== scrollAreaViewport) {
                if (scrollAreaViewport) {
                    scrollAreaViewport.removeEventListener('scroll', handleAreaScroll);
                }
                scrollAreaViewport = newViewport;
                scrollAreaViewport.addEventListener('scroll', handleAreaScroll, { passive: true });
                
                // Restore scroll
                const savedAreaScroll = sessionStorage.getItem(`areaScroll_${viewKey}`);
                if (savedAreaScroll) {
                    scrollAreaViewport.scrollTop = parseInt(savedAreaScroll, 10);
                }
            }
        };

        attachScrollArea();
        const timeout1 = setTimeout(attachScrollArea, 100);
        const timeout2 = setTimeout(attachScrollArea, 500);

        // Restore window scroll
        const savedWindowScroll = sessionStorage.getItem(`windowScroll_${viewKey}`);
        if (savedWindowScroll) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedWindowScroll, 10));
            }, 50);
        }

        return () => {
            window.removeEventListener('scroll', handleWindowScroll);
            if (scrollAreaViewport) {
                scrollAreaViewport.removeEventListener('scroll', handleAreaScroll);
            }
            clearTimeout(timeout1);
            clearTimeout(timeout2);
        };
    }, [viewKey, searchParams]);
}
