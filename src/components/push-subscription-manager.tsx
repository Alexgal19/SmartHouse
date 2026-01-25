"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { BellRing, Loader2 } from 'lucide-react';
import { useMainLayout } from './main-layout';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePushSubscription } from '@/hooks/use-push-subscription';

export const PushSubscriptionManager = () => {
    const { currentUser } = useMainLayout();
    const {
        pushSubscription,
        subscribe,
        unsubscribe,
        isSubscribing,
        isUnsubscribing,
        isSupported
    } = usePushSubscription();

    if (!currentUser) return null;
    if (!isSupported) return null;

    return (
        <Popover>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                             <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-accent hover:text-accent-foreground">
                                <BellRing className="h-5 w-5" />
                                {pushSubscription && (
                                     <span className="absolute bottom-1 right-1 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                     <TooltipContent>
                        <p>Powiadomienia Push</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h4 className="font-medium leading-none">Powiadomienia Push</h4>
                        <p className="text-sm text-muted-foreground">
                             {pushSubscription ? "Masz włączone powiadomienia na tym urządzeniu." : "Włącz, aby otrzymywać powiadomienia."}
                        </p>
                    </div>
                     {pushSubscription ? (
                        <Button 
                            variant="destructive" 
                            className="w-full"
                            onClick={unsubscribe}
                            disabled={isUnsubscribing}
                        >
                            {isUnsubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Wyłącz powiadomienia
                        </Button>
                    ) : (
                        <Button
                            className="w-full"
                            onClick={subscribe}
                            disabled={isSubscribing}
                        >
                            {isSubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Włącz powiadomienia
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};
