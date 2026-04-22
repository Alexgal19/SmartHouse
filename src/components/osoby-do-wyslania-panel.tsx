"use client";

import React, { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, Pencil, Undo2, AlertTriangle, CalendarIcon, Bus, Clock, Tag, Search } from 'lucide-react';
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
    patchResident: (id: string, patch: Partial<BokResident>) => void;
    onRefresh: () => void;
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
    patchResident,
    onRefresh,
}: OsobyDoWyslaniaProps) {
    const { toast } = useToast();
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editDateFor, setEditDateFor] = useState<string | null>(null);
    const [datePickerValue, setDatePickerValue] = useState<Date | undefined>(undefined);
    const [isSavingDate, setIsSavingDate] = useState(false);

    // Filters
    const [filterName, setFilterName] = useState('');
    const [filterAddress, setFilterAddress] = useState('all');
    const [filterReason, setFilterReason] = useState('all');
    const [filterDate, setFilterDate] = useState('all');

    const dispatched = useMemo(() => {
        return bokResidents.filter(
            r => r.status !== 'dismissed' && !r.dismissDate && !!r.sendDate,
        );
    }, [bokResidents]);

    const allAddresses = useMemo(() => {
        const set = new Set(dispatched.map(r => r.address || 'Nieznany adres'));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [dispatched]);

    const allReasons = useMemo(() => {
        const set = new Set(dispatched.map(r => r.sendReason || '').filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [dispatched]);

    const allDates = useMemo(() => {
        const set = new Set(dispatched.map(r => r.sendDate || '').filter(Boolean));
        return Array.from(set).sort();
    }, [dispatched]);

    const filtered = useMemo(() => {
        return dispatched.filter(r => {
            if (filterName) {
                const full = `${r.lastName} ${r.firstName}`.toLowerCase();
                if (!full.includes(filterName.toLowerCase())) return false;
            }
            if (filterAddress !== 'all' && (r.address || 'Nieznany adres') !== filterAddress) return false;
            if (filterReason !== 'all' && (r.sendReason || '') !== filterReason) return false;
            if (filterDate !== 'all' && (r.sendDate || '') !== filterDate) return false;
            return true;
        });
    }, [dispatched, filterName, filterAddress, filterReason, filterDate]);

    const grouped = useMemo(() => {
        const map = new Map<string, BokResident[]>();
        for (const r of filtered) {
            const key = r.address || 'Nieznany adres';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filtered]);

    const hasFilters = filterName || filterAddress !== 'all' || filterReason !== 'all' || filterDate !== 'all';

    const handleConfirm = async () => {
        if (!pending) return;
        setIsProcessing(true);
        setPending(null);

        const { resident, type } = pending;

        // Optimistic update — immediately reflect change in UI
        if (type === 'cofnij') {
            patchResident(resident.id, { sendDate: null, sendTime: null, sendReason: null });
        } else {
            patchResident(resident.id, { dismissDate: format(new Date(), 'yyyy-MM-dd'), status: 'dismissed' });
        }

        try {
            let result: { success: boolean; error?: string };
            if (type === 'cofnij') {
                result = await updateSendDateAction(resident.id, null, currentUser.uid);
            } else {
                result = await dismissBokResidentAction(resident.id, currentUser.uid);
            }
            if (result.success) {
                toast({
                    title: type === 'cofnij' ? 'Cofnięto wysyłkę ✅' : 'Osoba zwolniona ✅',
                    description: `${resident.lastName} ${resident.firstName} — ${type === 'cofnij' ? 'wróciła do Aktywni BOK' : 'przeniesiona do Zwolnieni'}`,
                });
            } else {
                // Revert on failure
                patchResident(resident.id, resident);
                toast({ title: 'Błąd', description: result.error, variant: 'destructive' });
            }
        } catch (err) {
            patchResident(resident.id, resident);
            toast({ title: 'Błąd', description: err instanceof Error ? err.message : 'Nieznany błąd', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveDate = async (resident: BokResident, date: Date) => {
        setIsSavingDate(true);
        const formatted = format(date, 'yyyy-MM-dd');

        // Optimistic update
        patchResident(resident.id, { sendDate: formatted });
        setEditDateFor(null);
        setDatePickerValue(undefined);

        try {
            const result = await updateSendDateAction(resident.id, formatted, currentUser.uid);
            if (result.success) {
                toast({ title: 'Data wysłania zaktualizowana ✅' });
                onRefresh(); // background sync
            } else {
                // Revert
                patchResident(resident.id, { sendDate: resident.sendDate });
                toast({ title: 'Błąd', description: result.error, variant: 'destructive' });
            }
        } catch (err) {
            patchResident(resident.id, { sendDate: resident.sendDate });
            toast({ title: 'Błąd', description: err instanceof Error ? err.message : 'Nieznany błąd', variant: 'destructive' });
        } finally {
            setIsSavingDate(false);
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
                                    {filtered.length}
                                    {filtered.length !== dispatched.length && (
                                        <span className="text-muted-foreground ml-1">/ {dispatched.length}</span>
                                    )}
                                    {' '}{dispatched.length === 1 ? 'osoba' : 'osób'}
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

                    {/* Filters */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[160px]">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Szukaj nazwiska..."
                                value={filterName}
                                onChange={e => setFilterName(e.target.value)}
                                className="h-8 text-xs pl-7"
                            />
                        </div>
                        <Select value={filterAddress} onValueChange={setFilterAddress}>
                            <SelectTrigger className="h-8 text-xs w-48">
                                <MapPin className="h-3 w-3 mr-1 shrink-0" />
                                <SelectValue placeholder="Adres" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">Wszystkie adresy</SelectItem>
                                {allAddresses.map(a => (
                                    <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterDate} onValueChange={setFilterDate}>
                            <SelectTrigger className="h-8 text-xs w-40">
                                <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
                                <SelectValue placeholder="Data" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">Wszystkie daty</SelectItem>
                                {allDates.map(d => (
                                    <SelectItem key={d} value={d} className="text-xs">{fmtDate(d)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {allReasons.length > 0 && (
                            <Select value={filterReason} onValueChange={setFilterReason}>
                                <SelectTrigger className="h-8 text-xs w-44">
                                    <Tag className="h-3 w-3 mr-1 shrink-0" />
                                    <SelectValue placeholder="Powód" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">Wszystkie powody</SelectItem>
                                    {allReasons.map(r => (
                                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground"
                                onClick={() => { setFilterName(''); setFilterAddress('all'); setFilterReason('all'); setFilterDate('all'); }}
                            >
                                Wyczyść filtry
                            </Button>
                        )}
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
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground w-full">
                                <p className="text-sm">Brak wyników dla wybranych filtrów.</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-6">
                                {grouped.map(([address, residents]) => (
                                    <div key={address}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                            <span className="text-xs font-semibold text-primary tracking-wide uppercase">{address}</span>
                                        </div>

                                        <div className="space-y-2">
                                            {residents.map(r => (
                                                <div
                                                    key={r.id}
                                                    className="rounded-xl border bg-card p-3.5 shadow-sm"
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                                        {/* Name + details */}
                                                        <div>
                                                            <div className="font-semibold text-sm">
                                                                {r.lastName} {r.firstName}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {r.roomNumber ? `Pokój ${r.roomNumber}` : '—'}
                                                                {r.nationality ? ` · ${r.nationality}` : ''}
                                                                {r.zaklad ? ` · ${r.zaklad}` : ''}
                                                            </div>
                                                            {r.checkInDate && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Zameldowanie: {fmtDate(r.checkInDate)}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Date + time + reason */}
                                                        <div className="flex flex-col gap-1 md:items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground whitespace-nowrap">Data wysłania:</span>
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
                                                            {r.sendTime && (
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <Clock className="h-3 w-3" />
                                                                    <span>{r.sendTime}</span>
                                                                </div>
                                                            )}
                                                            {r.sendReason && (
                                                                <div className="flex items-center gap-1">
                                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                                                        {r.sendReason}
                                                                    </Badge>
                                                                </div>
                                                            )}
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
                                                                Zwolnij
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
                                        : ' — osoba zostanie przeniesiona do Zwolnieni w BOK.'}
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
