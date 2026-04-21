"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    BedDouble, UserCheck, HeartPulse, Bus,
} from 'lucide-react';
import type { SessionData, OdbiorType } from '@/types';
import { useMainLayout } from '@/components/main-layout';
import { OdbiorZakwaterowanieDialog } from '@/components/odbior-zakwaterowanie-dialog';
import { OsobyDoWyslaniaView } from '@/components/osoby-do-wyslania-panel';

type Tile = {
    type: OdbiorType | 'wyslanie';
    title: string;
    description: string;
    icon: React.ElementType;
    enabled: boolean;
    adminOnly?: boolean;
    badge?: string;
};

export default function OdbiorView({ currentUser }: { currentUser: SessionData }) {
    const { settings, allBokResidents, refreshData, patchRawBokResident } = useMainLayout();
    const [isZakwaterowanieOpen, setIsZakwaterowanieOpen] = useState(false);
    const [isWyslanieOpen, setIsWyslanieOpen] = useState(false);

    // Count planned for dispatch (for badge on tile)
    const plannedCount = useMemo(() => {
        if (!allBokResidents) return 0;
        return allBokResidents.filter(r => r.status !== 'dismissed' && !r.dismissDate && !!r.sendDate).length;
    }, [allBokResidents]);

    const TILES: Tile[] = [
        { type: 'zakwaterowanie', title: 'Zakwaterowanie', description: 'Rejestracja przyjazdu i przydział pokoju', icon: BedDouble, enabled: true },
        { type: 'rozmowa_rekrutacyjna', title: 'Rozmowa rekrutacyjna', description: 'Wkrótce dostępne', icon: UserCheck, enabled: false },
        { type: 'badania', title: 'Badania', description: 'Wkrótce dostępne', icon: HeartPulse, enabled: false },
        {
            type: 'wyslanie',
            title: 'Osoby do wysłania',
            description: 'Planowanie wysyłki mieszkańców BOK',
            icon: Bus,
            enabled: true,
            adminOnly: false,
            badge: plannedCount > 0 ? String(plannedCount) : undefined,
        },
    ];

    const handleTileClick = (tile: Tile) => {
        if (!tile.enabled) return;
        if (tile.adminOnly && !currentUser.isAdmin && !currentUser.isDriver) return;
        if (tile.type === 'zakwaterowanie') {
            setIsZakwaterowanieOpen(true);
        } else if (tile.type === 'wyslanie') {
            setIsWyslanieOpen(true);
        }
    };

    const handleDialogClose = (open: boolean) => {
        setIsZakwaterowanieOpen(open);
    };

    const visibleTiles = TILES.filter(t => !t.adminOnly || currentUser.isAdmin || currentUser.isDriver);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Odbiór</h1>
                <p className="text-sm text-muted-foreground">
                    Wybierz typ odbioru — zakwaterowanie, rozmowa rekrutacyjna lub badania.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleTiles.map((tile) => {
                    const Icon = tile.icon;
                    const isAdminDisabled = tile.adminOnly && !currentUser.isAdmin && !currentUser.isDriver;
                    return (
                        <button
                            key={tile.type}
                            type="button"
                            onClick={() => handleTileClick(tile)}
                            disabled={!tile.enabled || isAdminDisabled}
                            className="group text-left"
                        >
                            <Card
                                className={
                                    tile.enabled && !isAdminDisabled
                                        ? 'h-full transition-all group-hover:border-primary group-hover:shadow-lg group-active:scale-[0.98]'
                                        : 'h-full opacity-60 cursor-not-allowed'
                                }
                            >
                                <CardContent className="p-6 flex flex-col items-start gap-4">
                                    <div className={
                                        tile.enabled && !isAdminDisabled
                                            ? 'rounded-xl bg-primary/10 p-4 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground relative'
                                            : 'rounded-xl bg-muted p-4 text-muted-foreground relative'
                                    }>
                                        <Icon className="h-8 w-8" />
                                        {tile.badge && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                                                {tile.badge}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-semibold">{tile.title}</h2>
                                            {!tile.enabled && (
                                                <Badge variant="secondary" className="text-[10px]">Wkrótce</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{tile.description}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </button>
                    );
                })}
            </div>

            {/* Wyslanie panel */}
            {isWyslanieOpen && (
                <OsobyDoWyslaniaView
                    onClose={() => setIsWyslanieOpen(false)}
                    bokResidents={allBokResidents || []}
                    currentUser={currentUser}
                    patchResident={patchRawBokResident}
                    onRefresh={async () => { await refreshData(false, true); }}
                />
            )}

            {/* Zakwaterowanie dialog */}
            {settings && (
                <OdbiorZakwaterowanieDialog
                    isOpen={isZakwaterowanieOpen}
                    onOpenChange={handleDialogClose}
                    currentUser={currentUser}
                    onSaved={async () => { await refreshData(false, true); }}
                />
            )}

        </div>
    );
}