"use client";

import React, { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Pencil, Undo2, AlertTriangle, CalendarIcon, Bus } from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { BokResident, SessionData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { updateSendDateAction, dismissBokResidentAction } from '@/lib/actions';
import { cn } from '@/lib/utils';

interface OsobyDoWyslaniaProps {
    onClose: () => void;
    bokResidents: BokResident[];
    currentUser: SessionData;
    onRefresh: () => Promise<void>;
}

const fmtDate = (v: string | null | undefined) => {
    if (!v) return '—';
    const d = parseISO(v);
    return isValid(d) ? format(d, 'd MMM yyyy', { locale: pl }) : v;
};

type ActionType = 'cofnij' | 'zwolnij';

interface PendingAction {
    resident: BokResident;
    type: ActionType;
}

export function OsobyDoWyslaniaView({
    onClose,
    bokResidents,
    currentUser,
    onRefresh,
}: OsobyDoWyslaniaProps) {
    const { toast } = useToast();
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editDateFor, setEditDateFor] = useState<string | null>(null); // bokId being edited
    const [datePickerValue, setDatePickerValue] = useState<Date | undefined>(undefined);
    const [isSavingDate, setIsSavingDate] = useState(false);

    // Filter: only BOK residents WITH sendDate and NOT dismissed
    const dispatched = useMemo(() => {
        return bokResidents.filter(
            r => r.status !== 'dismissed' && !r.dismissDate && !!r.sendDate,
        );
    }, [bokResidents]);

    // Group by address
    const grouped = useMemo(() => {
        const map = new Map<string, BokResident[]>();
        for (const r of dispatched) {
            const key = r.address || 'Nieznany adres';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [dispatched]);

    const handleConfirm = async () => {
        if (!pending) return;
        setIsProcessing(true);
        try {
            let result: { success: boolean; error?: string };
            if (pending.type === 'cofnij') {
                result = await updateSendDateAction(pending.resident.id, null, currentUser.uid);
            } else {
                result = await dismissBokResidentAction(pending.resident.id, currentUser.uid);
            }
            if (result.success) {
                toast({
                    title: pending.type === 'cofnij' ? 'Cofnięto wysyłkę ✅' : 'Osoba zwolniona ✅',
                    description: `${pending.resident.lastName} ${pending.resident.firstName} — ${pending.type === 'cofnij' ? 'wróciła do Aktywni BOK' : 'przeniesiona do Zwolnieni'}`,
                });
                await onRefresh();
            } else {
                toast({ title: 'Błąd', description: result.error, variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Błąd', description: err instanceof Error ? err.message : 'Nieznany błąd', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
            setPending(null);
        }
    };

    const handleSaveDate = async (resident: BokResident, date: Date) => {
        setIsSavingDate(true);
        try {
            const formatted = format(date, 'yyyy-MM-dd');
            const result = await updateSendDateAction(resident.id, formatted, currentUser.uid);
            if (result.success) {
                toast({ title: 'Data wysłania zaktualizowana ✅' });
                await onRefresh();
            } else {
                toast({ title: 'Błąd', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsSavingDate(false);
            setEditDateFor(null);
            setDatePickerValue(undefined);
        }
    };

    return (
        <>
            <Card className="w-full relative shadow-sm border-amber-200">
                <CardHeader className="bg-amber-50/50 border-b pb-4 rounded-t-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Bus className="h-5 w-5 text-amber-600" />
                                Osoby do wysłania
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    {dispatched.length} {dispatched.length === 1 ? 'osoba' : 'osób'}
                                </Badge>
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Lista osób zakwaterowanych z przypisaną datą wysłania.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={onClose} className="gap-1">
                            <Undo2 className="h-4 w-4" />
                            Wróć
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div>
                        {dispatched.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground w-full">
                                <span className="text-4xl mb-3">🚌</span>
                                <p className="text-sm">Brak osób zaplanowanych do wysłania.</p>
                                <p className="text-xs mt-1">Użyj trybu selekcji w zakładce Zakwaterowanie.</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-6">
                                {grouped.map(([address, residents]) => (
                                    <div key={address}>
                                        {/* Address header */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                            <span className="text-xs font-semibold text-primary tracking-wide uppercase">{address}</span>
                                        </div>

                                        <div className="space-y-2">
                                            {residents.map(r => (
                                                <div
                                                    key={r.id}
                                                    className="rounded-xl border bg-card p-3.5 space-y-2 shadow-sm"
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                                        <div>
                                                            <div className="font-semibold text-sm">
                                                                {r.lastName} {r.firstName}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {r.roomNumber ? `Pokój ${r.roomNumber}` : '—'}
                                                                {r.nationality ? ` · ${r.nationality}` : ''}
                                                                {r.zaklad ? ` · ${r.zaklad}` : ''}
                                                            </div>
                                                            {r.passportNumber && (
                                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                                    Paszport: {r.passportNumber}
                                                                </div>
                                                            )}
                                                            {r.checkInDate && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Zameldowanie: {fmtDate(r.checkInDate)}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Send date row with inline editing */}
                                                        <div className="flex items-center gap-2 md:justify-center">
                                                        <span className="text-xs text-muted-foreground">Data wysłania:</span>
                                                        <Popover
                                                            open={editDateFor === r.id}
                                                            onOpenChange={(open) => {
                                                                if (open) {
                                                                    setEditDateFor(r.id);
                                                                    const parsed = r.sendDate ? parseISO(r.sendDate) : undefined;
                                                                    setDatePickerValue(isValid(parsed) ? parsed : undefined);
                                                                } else {
                                                                    setEditDateFor(null);
                                                                }
                                                            }}
                                                        >
                                                            <PopoverTrigger asChild>
                                                                <button
                                                                    className={cn(
                                                                        'flex items-center gap-1 text-xs font-medium rounded px-1.5 py-0.5 transition-colors',
                                                                        'bg-primary/10 text-primary hover:bg-primary/20',
                                                                    )}
                                                                >
                                                                    <CalendarIcon className="h-3 w-3" />
                                                                    {fmtDate(r.sendDate)}
                                                                    <Pencil className="h-2.5 w-2.5 opacity-60" />
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={datePickerValue}
                                                                    onSelect={(date) => {
                                                                        if (date) {
                                                                            setDatePickerValue(date);
                                                                            handleSaveDate(r, date);
                                                                        }
                                                                    }}
                                                                    locale={pl}
                                                                    initialFocus
                                                                />
                                                                {isSavingDate && (
                                                                    <div className="flex items-center justify-center p-2 border-t text-xs text-muted-foreground gap-1">
                                                                        <Loader2 className="h-3 w-3 animate-spin" /> Zapisuję...
                                                                    </div>
                                                                )}
                                                            </PopoverContent>
                                                        </Popover>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-2 md:justify-end flex-wrap">
                                                            <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1"
                                                            onClick={() => setPending({ resident: r, type: 'cofnij' })}
                                                        >
                                                            <Undo2 className="h-3 w-3" />
                                                            Cofnij wysyłkę
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1"
                                                            onClick={() => setPending({ resident: r, type: 'zwolnij' })}
                                                        >
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Zwolnij (uciekła)
                                                        </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Confirmation dialog */}
            <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pending?.type === 'cofnij' ? 'Cofnąć wysyłkę?' : 'Zwolnić osobę?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pending && (
                                <>
                                    <strong>{pending.resident.lastName} {pending.resident.firstName}</strong>
                                    {pending.type === 'cofnij'
                                        ? ' — data wysłania zostanie wyczyszczona. Osoba wróci do widoku Aktywni w BOK.'
                                        : ' — osoba zostanie przeniesiona do Zwolnieni w BOK (uciekła lub podobna sytuacja).'}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessing}>Anuluj</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className={cn(
                                pending?.type === 'zwolnij' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                            )}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {pending?.type === 'cofnij' ? 'Cofnij wysyłkę' : 'Zwolnij'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
