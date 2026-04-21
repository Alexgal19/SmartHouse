"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Camera, Loader2, X, CalendarIcon, ChevronRight, Check, Bed,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import Webcam from 'react-webcam';
import { cn } from '@/lib/utils';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';
import { useToast } from '@/hooks/use-toast';
import type { Address } from '@/types';

// ─── Step indicator ────────────────────────────────────────────────────────────

export function WizardStepIndicator({ steps, current }: { steps: string[]; current: number }) {
    return (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 border-b bg-muted/30 flex-shrink-0 px-2">
            {steps.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <React.Fragment key={label}>
                        <div className="flex flex-col items-center gap-0.5">
                            <div className={cn(
                                'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all',
                                done && 'bg-primary text-primary-foreground',
                                active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                                !done && !active && 'bg-muted text-muted-foreground',
                            )}>
                                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                            </div>
                            <span className={cn(
                                'text-[9px] sm:text-[10px] hidden sm:block truncate max-w-[56px] text-center',
                                active ? 'text-primary font-medium' : 'text-muted-foreground',
                            )}>{label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={cn(
                                'h-0.5 w-6 sm:w-10 rounded transition-colors mb-3',
                                i < current ? 'bg-primary' : 'bg-muted',
                            )} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Date input ───────────────────────────────────────────────────────────────

export function WizardDateInput({
    value,
    onChange,
    placeholder = 'Wybierz datę',
    className,
}: {
    value: Date | null | undefined;
    onChange: (date: Date | null) => void;
    placeholder?: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex h-12 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base',
                        className,
                    )}
                >
                    <span className={value && isValid(value) ? '' : 'text-muted-foreground'}>
                        {value && isValid(value) ? format(value, 'd MMMM yyyy', { locale: pl }) : placeholder}
                    </span>
                    <CalendarIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="start" sideOffset={5}>
                <Calendar
                    locale={pl}
                    mode="single"
                    selected={value && isValid(value) ? value : undefined}
                    onSelect={(d) => { onChange(d ?? null); setOpen(false); }}
                    initialFocus
                    className="rounded-md border"
                />
            </PopoverContent>
        </Popover>
    );
}

// ─── OCR camera ───────────────────────────────────────────────────────────────

export type OcrResult = {
    firstName: string;
    lastName: string;
    nationality: string;
    passportNumber: string;
};

export function OcrCameraButton({
    onResult,
    settings,
    disabled,
}: {
    onResult: (result: OcrResult) => void;
    settings: { nationalities: string[] } | null;
    disabled?: boolean;
}) {
    const { toast } = useToast();
    const webcamRef = useRef<Webcam>(null);
    const [open, setOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const handleCapture = () => {
        const dataUri = webcamRef.current?.getScreenshot();
        if (!dataUri) return;
        setIsScanning(true);
        extractPassportData({ photoDataUri: dataUri })
            .then(({ firstName, lastName, nationality, passportNumber }) => {
                const warnings: string[] = [];
                const result: OcrResult = { firstName: '', lastName: '', nationality: '', passportNumber: '' };
                if (firstName) result.firstName = firstName; else warnings.push('imię');
                if (lastName) result.lastName = lastName; else warnings.push('nazwisko');
                if (nationality) {
                    const matched = settings?.nationalities.find(
                        (n) => n.toLowerCase() === nationality.toLowerCase()
                    );
                    result.nationality = matched || nationality;
                } else warnings.push('narodowość');
                if (passportNumber) result.passportNumber = passportNumber; else warnings.push('nr paszportu');
                onResult(result);
                if (warnings.length === 0) {
                    toast({ title: 'Sukces', description: 'Dane z dokumentu zostały wczytane.' });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Częściowy odczyt',
                        description: `Nie udało się odczytać: ${warnings.join(', ')}. Uzupełnij ręcznie.`,
                    });
                }
                setOpen(false);
            })
            .catch((error) => {
                toast({
                    variant: 'destructive',
                    title: 'Błąd skanowania',
                    description: error instanceof Error ? error.message : 'Spróbuj ponownie.',
                });
            })
            .finally(() => setIsScanning(false));
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled || isScanning}
                className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all py-5 text-primary font-semibold text-base disabled:opacity-50"
            >
                {isScanning
                    ? <Loader2 className="w-6 h-6 animate-spin" />
                    : <Camera className="w-6 h-6" />}
                {isScanning ? 'Przetwarzanie...' : 'Skanuj paszport / dowód'}
            </button>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
                    <div className="p-4 pb-2">
                        <h3 className="font-semibold text-base">Skanuj dokument</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Kod MRZ na dole musi być widoczny w kadrze.</p>
                    </div>
                    <div className="relative bg-black">
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: { ideal: 'environment' } }}
                            className="w-full"
                        />
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="p-4 flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={isScanning}>Anuluj</Button>
                        <Button onClick={handleCapture} disabled={isScanning}>
                            {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                            Zrób zdjęcie
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Generic address + room picker ───────────────────────────────────────────

export type WizardAddressItem = {
    address: Address;
    totalCapacity: number;
    totalAvailable: number;
    rooms: {
        id: string;
        name: string;
        capacity: number;
        available: number;
        isActive: boolean;
        isLocked: boolean;
    }[];
};

export function buildAddressItems(
    addresses: Address[],
    activeEmployees: { address: string; roomNumber: string; status: string }[],
    activeNonEmployees: { address: string; roomNumber: string; status: string }[],
    activeBokResidents: { address: string; roomNumber: string; status: string; dismissDate: string | null; sendDate: string | null }[],
): WizardAddressItem[] {
    return addresses
        .filter((a) => a.isActive)
        .map((address) => {
            const emps = activeEmployees.filter((e) => e.address === address.name);
            const nes = activeNonEmployees.filter((e) => e.address === address.name);
            const boks = activeBokResidents.filter((b) => b.address === address.name);

            const rooms = (address.rooms || [])
                .filter((r) => r.isActive)
                .map((room) => {
                    let occ = 0;
                    occ += emps.filter((e) => String(e.roomNumber) === room.name).length;
                    occ += nes.filter((e) => String(e.roomNumber) === room.name).length;
                    occ += boks.filter((b) => String(b.roomNumber) === room.name).length;
                    return {
                        id: room.id, name: room.name, capacity: room.capacity,
                        available: Math.max(0, room.capacity - occ),
                        isActive: room.isActive, isLocked: room.isLocked === true,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            const totalCapacity = rooms.reduce((s, r) => s + (r.isLocked ? 0 : r.capacity), 0);
            const totalAvailable = rooms.reduce((s, r) => s + (r.isLocked ? 0 : r.available), 0);
            return { address, totalCapacity, totalAvailable, rooms };
        })
        .sort((a, b) => a.address.locality.localeCompare(b.address.locality) || a.address.name.localeCompare(b.address.name));
}

export function WizardAddressPicker({
    items,
    selectedAddressName,
    selectedRoom,
    onSelect,
    allowOwnAddress,
    ownAddressValue,
    onOwnAddressChange,
}: {
    items: WizardAddressItem[];
    selectedAddressName: string;
    selectedRoom: string;
    onSelect: (addressName: string, roomNumber: string) => void;
    allowOwnAddress?: boolean;
    ownAddressValue?: string;
    onOwnAddressChange?: (v: string) => void;
}) {
    const OWN_ADDRESS_KEY = '__own__';
    const isOwn = selectedAddressName === OWN_ADDRESS_KEY;
    const [expandedId, setExpandedId] = useState<string | null>(
        items.find((it) => it.address.name === selectedAddressName)?.address.id || null
    );
    const [search, setSearch] = useState('');

    const grouped = React.useMemo(() => {
        const q = search.toLowerCase();
        const filtered = q
            ? items.filter((it) => it.address.name.toLowerCase().includes(q) || it.address.locality.toLowerCase().includes(q))
            : items;
        const map = new Map<string, WizardAddressItem[]>();
        for (const it of filtered) {
            const loc = it.address.locality || 'Inne';
            if (!map.has(loc)) map.set(loc, []);
            map.get(loc)!.push(it);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [items, search]);

    return (
        <div className="space-y-3">
            <Input
                placeholder="Szukaj adresu lub miejscowości..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11"
            />

            {grouped.length === 0 && !allowOwnAddress && (
                <div className="text-center py-10 text-sm text-muted-foreground">Brak dostępnych adresów.</div>
            )}

            {grouped.map(([locality, locItems]) => (
                <div key={locality}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">{locality}</div>
                    <div className="space-y-1.5">
                        {locItems.map((it) => {
                            const sel = selectedAddressName === it.address.name;
                            const exp = expandedId === it.address.id;
                            return (
                                <div key={it.address.id} className={cn(
                                    'rounded-xl border-2 transition-all overflow-hidden',
                                    sel ? 'border-primary bg-primary/5' : 'border-border bg-card',
                                )}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(exp ? null : it.address.id)}
                                        className="w-full text-left p-3.5 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-semibold text-sm truncate">{it.address.name}</span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Badge variant={it.totalAvailable > 0 ? 'default' : 'secondary'} className="text-xs">
                                                    {it.totalAvailable} wolnych
                                                </Badge>
                                                <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', exp && 'rotate-90')} />
                                            </div>
                                        </div>
                                    </button>
                                    {exp && (
                                        <div className="border-t px-3 py-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {it.rooms.map((room) => {
                                                const disabled = !room.isActive || room.isLocked || room.available <= 0;
                                                const roomSel = sel && selectedRoom === room.name;
                                                return (
                                                    <button
                                                        key={room.id}
                                                        type="button"
                                                        disabled={disabled}
                                                        onClick={() => onSelect(it.address.name, room.name)}
                                                        className={cn(
                                                            'flex flex-col items-center rounded-lg border-2 p-2.5 gap-1 transition-all',
                                                            roomSel && 'border-primary bg-primary text-primary-foreground',
                                                            !roomSel && !disabled && 'border-border hover:border-primary/50 hover:bg-muted/50 active:scale-95',
                                                            disabled && 'opacity-40 cursor-not-allowed border-border',
                                                        )}
                                                    >
                                                        <Bed className={cn('w-4 h-4', roomSel ? 'text-primary-foreground' : 'text-muted-foreground')} />
                                                        <span className="text-xs font-semibold">{room.name}</span>
                                                        <span className={cn('text-[10px]', roomSel ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                                            {room.isLocked ? 'Zablok.' : !room.isActive ? 'Niedost.' : `${room.available}/${room.capacity}`}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {allowOwnAddress && (
                <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">Własne</div>
                    <div className={cn(
                        'rounded-xl border-2 transition-all overflow-hidden',
                        isOwn ? 'border-primary bg-primary/5' : 'border-border bg-card',
                    )}>
                        <button
                            type="button"
                            onClick={() => onSelect(OWN_ADDRESS_KEY, '')}
                            className="w-full text-left p-3.5 hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-sm">Własne mieszkanie</span>
                                {isOwn && <Check className="w-4 h-4 text-primary" />}
                            </div>
                        </button>
                        {isOwn && (
                            <div className="border-t px-3 py-2.5">
                                <Input
                                    placeholder="Wpisz adres własnego mieszkania..."
                                    value={ownAddressValue || ''}
                                    onChange={(e) => onOwnAddressChange?.(e.target.value)}
                                    className="h-10"
                                    autoFocus
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Gender picker ────────────────────────────────────────────────────────────

export function WizardGenderPicker({
    genders,
    value,
    onChange,
}: {
    genders: string[];
    value: string;
    onChange: (g: string) => void;
}) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {genders.filter(Boolean).map((g) => (
                <button
                    key={g}
                    type="button"
                    onClick={() => onChange(g)}
                    className={cn(
                        'rounded-xl border-2 py-3 px-2 text-sm font-semibold transition-all active:scale-95',
                        value === g
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    )}
                >
                    {g}
                </button>
            ))}
        </div>
    );
}
