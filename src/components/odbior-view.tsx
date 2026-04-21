"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    BedDouble, UserCheck, HeartPulse, Loader2, ClipboardList, Pencil,
    Trash2, Bus,
} from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SessionData, OdbiorEntry, OdbiorType } from '@/types';
import { useMainLayout } from '@/components/main-layout';
import { getOdbiorEntriesAction, deleteOdbiorEntryAction } from '@/lib/actions';
import { OdbiorZakwaterowanieDialog } from '@/components/odbior-zakwaterowanie-dialog';
import { OsobyDoWyslaniaView } from '@/components/osoby-do-wyslania-panel';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';

type Tile = {
    type: OdbiorType | 'wyslanie';
    title: string;
    description: string;
    icon: React.ElementType;
    enabled: boolean;
    adminOnly?: boolean;
    badge?: string;
};

const formatDisplayDate = (value: string | null | undefined) => {
    if (!value) return '—';
    const d = parseISO(value);
    if (!isValid(d)) return value;
    return format(d, 'd MMM yyyy', { locale: pl });
};

export default function OdbiorView({ currentUser }: { currentUser: SessionData }) {
    const { settings, allBokResidents, odbiorEntries, refreshData } = useMainLayout();
    const { toast } = useToast();
    const [localEntries, setLocalEntries] = useState<OdbiorEntry[] | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isZakwaterowanieOpen, setIsZakwaterowanieOpen] = useState(false);
    const [isWyslanieOpen, setIsWyslanieOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<OdbiorEntry | null>(null);
    const [deletingEntry, setDeletingEntry] = useState<OdbiorEntry | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Use context data (pre-fetched by main layout) — fall back to local state after manual refresh
    const entries = localEntries ?? odbiorEntries;
    const isLoading = entries === null;

    const refreshEntries = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const data = await getOdbiorEntriesAction();
            setLocalEntries(data);
        } catch (err) {
            console.error('Failed to load odbior entries:', err);
            setLocalEntries([]);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

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

    const recentEntries = useMemo(() => {
        if (!entries) return [];
        return [...entries]
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 10);
    }, [entries]);

    const handleTileClick = (tile: Tile) => {
        if (!tile.enabled) return;
        if (tile.adminOnly && !currentUser.isAdmin && !currentUser.isDriver) return;
        if (tile.type === 'zakwaterowanie') {
            setEditingEntry(null);
            setIsZakwaterowanieOpen(true);
        } else if (tile.type === 'wyslanie') {
            setIsWyslanieOpen(true);
        }
    };

    const handleEditEntry = (entry: OdbiorEntry) => {
        setEditingEntry(entry);
        setIsZakwaterowanieOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setIsZakwaterowanieOpen(open);
        if (!open) setEditingEntry(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingEntry) return;
        setIsDeleting(true);
        try {
            const result = await deleteOdbiorEntryAction(
                deletingEntry.id,
                deletingEntry.convertedToBokId ?? null,
            );
            if (result.success) {
                toast({
                    title: 'Rekord usunięty ✅',
                    description: deletingEntry.convertedToBokId
                        ? 'Wpis z historii i powiązany rekord BOK zostały usunięte.'
                        : 'Wpis z historii przyjęć został usunięty.',
                });
                await Promise.all([refreshEntries(), refreshData(false, true)]);
            } else {
                toast({ title: 'Błąd usuwania', description: result.error, variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Błąd', description: err instanceof Error ? err.message : 'Nieznany błąd', variant: 'destructive' });
        } finally {
            setIsDeleting(false);
            setDeletingEntry(null);
        }
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

            {/* History card */}
            {isWyslanieOpen ? (
                <OsobyDoWyslaniaView
                    onClose={() => setIsWyslanieOpen(false)}
                    bokResidents={allBokResidents || []}
                    currentUser={currentUser}
                    onRefresh={async () => { await refreshData(false, true); }}
                />
            ) : (
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold">Historia przyjęć</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={refreshEntries}
                                    disabled={isLoading || isRefreshing}
                                    className="h-7 text-xs"
                                >
                                    {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Odśwież'}
                                </Button>
                            </div>
                        </div>

                        {isLoading && !entries ? (
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : recentEntries.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                Brak wpisów. Dodaj pierwszy przez kafelek Zakwaterowanie.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {recentEntries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 group -mx-2 px-2 rounded hover:bg-muted/50 transition-colors"
                                    >
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={() => handleEditEntry(entry)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEditEntry(entry); }}
                                        >
                                            <div className="font-medium truncate">
                                                {entry.lastName} {entry.firstName}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {entry.addressName || '—'}
                                                {entry.roomNumber ? ` · pokój ${entry.roomNumber}` : ''}
                                                {entry.nationality ? ` · ${entry.nationality}` : ''}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDisplayDate(entry.date)}
                                            </span>
                                            <Badge variant="secondary" className="text-[10px]">BOK</Badge>
                                            <Pencil
                                                className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                onClick={() => handleEditEntry(entry)}
                                            />
                                            <button
                                                type="button"
                                                title="Usuń rekord"
                                                onClick={(e) => { e.stopPropagation(); setDeletingEntry(entry); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-0.5 rounded"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Delete confirmation */}
            <AlertDialog open={!!deletingEntry} onOpenChange={(open) => { if (!open) setDeletingEntry(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Usuń rekord na zawsze?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deletingEntry && (
                                <>
                                    Usuniesz wpis <strong>{deletingEntry.lastName} {deletingEntry.firstName}</strong>
                                    {' '}z historii przyjęć.
                                    {deletingEntry.convertedToBokId && (
                                        <span className="block mt-2 text-destructive font-medium">
                                            ⚠️ Ten rekord ma powiązany wpis w tabeli BOK — zostanie on też usunięty.
                                        </span>
                                    )}
                                    <span className="block mt-2">Tej operacji nie można cofnąć.</span>
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Usuń na zawsze
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Zakwaterowanie dialog */}
            {settings && (
                <OdbiorZakwaterowanieDialog
                    isOpen={isZakwaterowanieOpen}
                    onOpenChange={handleDialogClose}
                    currentUser={currentUser}
                    onSaved={async () => { await Promise.all([refreshEntries(), refreshData(false, true)]); }}
                    editEntry={editingEntry}
                />
            )}

        </div>
    );
}