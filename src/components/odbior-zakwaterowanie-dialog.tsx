"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';

import { WizardDateInput } from '@/components/wizard-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Camera, Loader2, X, ChevronRight,
    ChevronLeft, Check, Bed, MapPin, User, ClipboardList,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import Webcam from 'react-webcam';
import { useToast } from '@/hooks/use-toast';
import { useMainLayout } from '@/components/main-layout';
import { addOdbiorZakwaterowanieAction, updateOdbiorZakwaterowanieAction } from '@/lib/actions';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';
import type { SessionData, Address, OdbiorEntry } from '@/types';
import { cn } from '@/lib/utils';

type AddressPickerItem = {
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

type WizardData = {
    firstName: string;
    lastName: string;
    addressId: string;
    addressName: string;
    roomNumber: string;
    nationality: string;
    gender: string;
    passportNumber: string;
    date: Date;
};

const STEPS = ['Osoba', 'Lokalizacja', 'Szczegóły', 'Podsumowanie'] as const;
type Step = 0 | 1 | 2 | 3;

const isTempHousingLocality = (locality: string | undefined): boolean => {
    if (!locality) return false;
    return locality
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0142/g, 'l')
        .startsWith('mieszkania');
};

function StepIndicator({ current }: { current: Step }) {
    return (
        <div className="flex items-center justify-center gap-2 py-3 border-b bg-muted/30 flex-shrink-0">
            {STEPS.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <React.Fragment key={label}>
                        <div className="flex flex-col items-center gap-0.5">
                            <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                                done && 'bg-primary text-primary-foreground',
                                active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                                !done && !active && 'bg-muted text-muted-foreground',
                            )}>
                                {done ? <Check className="w-4 h-4" /> : i + 1}
                            </div>
                            <span className={cn(
                                'text-[10px] hidden sm:block',
                                active ? 'text-primary font-medium' : 'text-muted-foreground',
                            )}>{label}</span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={cn(
                                'h-0.5 w-8 sm:w-10 rounded transition-colors mb-3',
                                i < current ? 'bg-primary' : 'bg-muted',
                            )} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function StepOsoba({
    data,
    onChange,
    settings,
}: {
    data: WizardData;
    onChange: (patch: Partial<WizardData>) => void;
    settings: ReturnType<typeof useMainLayout>['settings'];
}) {
    const { toast } = useToast();
    const webcamRef = useRef<Webcam>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const handleCapture = () => {
        const dataUri = webcamRef.current?.getScreenshot();
        if (!dataUri) return;
        setIsScanning(true);
        extractPassportData({ photoDataUri: dataUri })
            .then(({ firstName, lastName, nationality, passportNumber }) => {
                const patch: Partial<WizardData> = {};
                const warnings: string[] = [];
                if (firstName) patch.firstName = firstName; else warnings.push('imię');
                if (lastName) patch.lastName = lastName; else warnings.push('nazwisko');
                if (nationality) {
                    const matched = settings?.nationalities.find(
                        (n) => n.toLowerCase() === nationality.toLowerCase()
                    );
                    patch.nationality = matched || nationality;
                } else warnings.push('narodowość');
                if (passportNumber) patch.passportNumber = passportNumber; else warnings.push('nr paszportu');
                onChange(patch);
                if (warnings.length === 0) {
                    toast({ title: 'Sukces', description: 'Dane z dokumentu zostały wczytane.' });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Częściowy odczyt',
                        description: `Nie udało się odczytać: ${warnings.join(', ')}. Uzupełnij ręcznie.`,
                    });
                }
                setIsCameraOpen(false);
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
            <div className="flex flex-col gap-6 p-6 sm:p-8">
                <div className="text-center space-y-1">
                    <User className="w-10 h-10 mx-auto text-primary" />
                    <h2 className="text-xl font-bold">Dane osoby</h2>
                    <p className="text-sm text-muted-foreground">Wpisz ręcznie lub zeskanuj paszport</p>
                </div>

                <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isScanning}
                    className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all py-5 text-primary font-semibold text-base"
                >
                    {isScanning
                        ? <Loader2 className="w-6 h-6 animate-spin" />
                        : <Camera className="w-6 h-6" />}
                    {isScanning ? 'Przetwarzanie...' : 'Skanuj paszport / dowód'}
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Nazwisko</label>
                        <Input
                            placeholder="Kowalski"
                            value={data.lastName}
                            onChange={(e) => onChange({ lastName: e.target.value })}
                            className="h-12 text-base"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Imię</label>
                        <Input
                            placeholder="Jan"
                            value={data.firstName}
                            onChange={(e) => onChange({ firstName: e.target.value })}
                            className="h-12 text-base"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Narodowość</label>
                    <Combobox
                        options={settings?.nationalities?.slice().sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })) || []}
                        value={data.nationality}
                        onChange={(val) => onChange({ nationality: val })}
                        placeholder="Wybierz narodowość"
                        searchPlaceholder="Szukaj..."
                    />
                </div>
            </div>

            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && setIsCameraOpen(false)}>
                <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
                    <div className="p-4 pb-2">
                        <h3 className="font-semibold text-base">Skanuj paszport</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Kod MRZ na dole dokumentu musi być widoczny.</p>
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
                            onClick={() => setIsCameraOpen(false)}
                            className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="p-4 flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setIsCameraOpen(false)} disabled={isScanning}>Anuluj</Button>
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

function StepLokalizacja({
    data,
    onChange,
    items,
}: {
    data: WizardData;
    onChange: (patch: Partial<WizardData>) => void;
    items: AddressPickerItem[];
}) {
    const [expandedId, setExpandedId] = useState<string | null>(data.addressId || null);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter((it) =>
            it.address.name.toLowerCase().includes(q) ||
            it.address.locality.toLowerCase().includes(q)
        );
    }, [items, search]);

    const handleSelectRoom = (item: AddressPickerItem, roomName: string) => {
        onChange({ addressId: item.address.id, addressName: item.address.name, roomNumber: roomName });
    };

    return (
        <div className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="text-center space-y-1 relative">
                <MapPin className="w-10 h-10 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Lokalizacja</h2>
                <p className="text-sm text-muted-foreground">Wybierz adres i pokój</p>
            </div>

            <Input
                placeholder="Szukaj adresu lub miejscowości..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11"
            />

            {filtered.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                    Brak mieszkań tymczasowych z wolnymi miejscami.
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((it) => {
                        const isSelected = data.addressId === it.address.id;
                        const isExpanded = expandedId === it.address.id;
                        return (
                            <div key={it.address.id} className={cn(
                                'rounded-xl border-2 transition-all overflow-hidden',
                                isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                            )}>
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : it.address.id)}
                                    className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold text-sm sm:text-base truncate">{it.address.name}</div>
                                            <div className="text-xs text-muted-foreground">{it.address.locality}</div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Badge variant={it.totalAvailable > 0 ? 'default' : 'secondary'} className="text-xs">
                                                {it.totalAvailable} wolnych
                                            </Badge>
                                            <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                                        </div>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {it.rooms.map((room) => {
                                            const disabled = !room.isActive || room.isLocked || room.available <= 0;
                                            const roomSelected = isSelected && data.roomNumber === room.name;
                                            return (
                                                <button
                                                    key={room.id}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => handleSelectRoom(it, room.name)}
                                                    className={cn(
                                                        'flex flex-col items-center justify-center rounded-lg border-2 p-3 gap-1 transition-all',
                                                        roomSelected && 'border-primary bg-primary text-primary-foreground',
                                                        !roomSelected && !disabled && 'border-border hover:border-primary/50 hover:bg-muted/50 active:scale-95',
                                                        disabled && 'opacity-40 cursor-not-allowed border-border',
                                                    )}
                                                >
                                                    <Bed className={cn('w-5 h-5', roomSelected ? 'text-primary-foreground' : 'text-muted-foreground')} />
                                                    <span className="text-sm font-semibold">{room.name}</span>
                                                    <span className={cn('text-[11px]', roomSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
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
            )}
        </div>
    );
}

function StepSzczegoly({
    data,
    onChange,
    settings,
}: {
    data: WizardData;
    onChange: (patch: Partial<WizardData>) => void;
    settings: ReturnType<typeof useMainLayout>['settings'];
}) {
    const sortedGenders = useMemo(
        () => [...(settings?.genders || [])].sort((a, b) => a.localeCompare(b)),
        [settings]
    );

    return (
        <div className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="text-center space-y-1">
                <ClipboardList className="w-10 h-10 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Szczegóły</h2>
                <p className="text-sm text-muted-foreground">Uzupełnij pozostałe dane</p>
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Płeć</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {sortedGenders.filter(Boolean).map((g) => (
                        <button
                            key={g}
                            type="button"
                            onClick={() => onChange({ gender: g })}
                            className={cn(
                                'rounded-xl border-2 py-3 px-2 text-sm font-semibold transition-all active:scale-95',
                                data.gender === g
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                            )}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Numer paszportu</label>
                <Input
                    placeholder="np. EP1234567"
                    value={data.passportNumber}
                    onChange={(e) => onChange({ passportNumber: e.target.value.toUpperCase() })}
                    className="h-12 text-base font-mono"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium">Data przyjęcia</label>
                <WizardDateInput
                    value={data.date}
                    onChange={(d) => onChange({ date: d ?? new Date() })}
                />
            </div>
        </div>
    );
}

function StepPodsumowanie({
    data,
    onEdit,
}: {
    data: WizardData;
    onEdit: (step: Step) => void;
}) {
    const rows: { label: string; value: string; step: Step }[] = [
        { label: 'Nazwisko', value: data.lastName || '—', step: 0 },
        { label: 'Imię', value: data.firstName || '—', step: 0 },
        { label: 'Adres', value: data.addressName || '—', step: 1 },
        { label: 'Pokój', value: data.roomNumber || '—', step: 1 },
        { label: 'Narodowość', value: data.nationality || '—', step: 2 },
        { label: 'Płeć', value: data.gender || '—', step: 2 },
        { label: 'Nr paszportu', value: data.passportNumber || '—', step: 2 },
        {
            label: 'Data',
            value: data.date && isValid(data.date) ? format(data.date, 'd MMMM yyyy', { locale: pl }) : '—',
            step: 2,
        },
    ];

    return (
        <div className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="text-center space-y-1">
                <Check className="w-10 h-10 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Podsumowanie</h2>
                <p className="text-sm text-muted-foreground">Sprawdź dane przed zapisem</p>
            </div>

            <div className="rounded-xl border divide-y">
                {rows.map(({ label, value, step }) => (
                    <div
                        key={label}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 cursor-pointer group"
                        onClick={() => onEdit(step)}
                    >
                        <div>
                            <div className="text-xs text-muted-foreground">{label}</div>
                            <div className="text-sm font-medium">{value}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                ))}
            </div>

            <p className="text-xs text-center text-muted-foreground">
                Kliknij dowolny wiersz aby wrócić i edytować.
            </p>
        </div>
    );
}

const DEFAULT_DATA: Omit<WizardData, 'date'> = {
    firstName: '',
    lastName: '',
    addressId: '',
    addressName: '',
    roomNumber: '',
    nationality: '',
    gender: '',
    passportNumber: '',
};

export function OdbiorZakwaterowanieDialog({
    isOpen,
    onOpenChange,
    currentUser,
    onSaved,
    editEntry,
    prefillData,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUser: SessionData;
    onSaved?: () => void;
    editEntry?: OdbiorEntry | null;
    prefillData?: { firstName?: string; lastName?: string; passportNumber?: string };
}) {
    const { toast } = useToast();
    const { settings, allEmployees, allNonEmployees, allBokResidents, addRawOdbiorEntry, patchRawOdbiorEntry, addRawBokResident, patchRawBokResident } = useMainLayout();
    const [step, setStep] = useState<Step>(0);
    const [data, setData] = useState<WizardData>({ ...DEFAULT_DATA, date: new Date() });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEditing = !!editEntry;

    useEffect(() => {
        if (isOpen) {
            setStep(0);
            if (editEntry) {
                const parsed = editEntry.date ? new Date(editEntry.date + 'T00:00:00') : new Date();
                setData({
                    firstName: editEntry.firstName || '',
                    lastName: editEntry.lastName || '',
                    addressId: editEntry.addressId || '',
                    addressName: editEntry.addressName || '',
                    roomNumber: editEntry.roomNumber || '',
                    nationality: editEntry.nationality || '',
                    gender: editEntry.gender || '',
                    passportNumber: editEntry.passportNumber || '',
                    date: isValid(parsed) ? parsed : new Date(),
                });
            } else {
                setData({
                    ...DEFAULT_DATA,
                    date: new Date(),
                    firstName: prefillData?.firstName ?? '',
                    lastName: prefillData?.lastName ?? '',
                    passportNumber: prefillData?.passportNumber ?? '',
                });
            }
        }
        // prefillData intentionally excluded — applies only on dialog open, not on every prefill change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editEntry]);

    const onChange = (patch: Partial<WizardData>) => setData((prev) => ({ ...prev, ...patch }));

    const addressPickerItems: AddressPickerItem[] = useMemo(() => {
        if (!settings) return [];
        const tempAddresses = settings.addresses.filter((a) => a.isActive && isTempHousingLocality(a.locality));
        const activeEmps = (allEmployees || []).filter((e) => e.status === 'active');
        const activeNE = (allNonEmployees || []).filter((ne) => ne.status === 'active');
        const activeBok = (allBokResidents || []).filter((b) => b.status !== 'dismissed' && !b.dismissDate && !b.sendDate);

        return tempAddresses
            .map((address) => {
                const rooms = (address.rooms || [])
                    .filter((r) => r.isActive)
                    .map((room) => {
                        let occupied = 0;
                        occupied += activeEmps.filter((e) => e.address === address.name && String(e.roomNumber) === room.name).length;
                        occupied += activeNE.filter((e) => e.address === address.name && String(e.roomNumber) === room.name).length;
                        occupied += activeBok.filter((b) => b.address === address.name && String(b.roomNumber) === room.name).length;
                        let available = Math.max(0, room.capacity - occupied);
                        if (isEditing && editEntry?.addressId === address.id && editEntry?.roomNumber === room.name) {
                            available = Math.max(1, available);
                        }
                        return {
                            id: room.id, name: room.name, capacity: room.capacity,
                            available,
                            isActive: room.isActive, isLocked: room.isLocked === true,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                const totalCapacity = rooms.reduce((s, r) => s + (r.isLocked ? 0 : r.capacity), 0);
                const totalAvailable = rooms.reduce((s, r) => s + (r.isLocked ? 0 : r.available), 0);
                return { address, totalCapacity, totalAvailable, rooms };
            })
            .filter((it) => it.totalAvailable > 0 || (isEditing && editEntry?.addressId === it.address.id))
            .sort((a, b) => a.address.name.localeCompare(b.address.name));
    }, [settings, allEmployees, allNonEmployees, allBokResidents, isEditing, editEntry]);

    const canProceed = useMemo(() => {
        if (step === 0) return data.firstName.trim() !== '' && data.lastName.trim() !== '' && data.nationality !== '';
        if (step === 1) return data.addressId !== '' && data.roomNumber !== '';
        if (step === 2) return data.gender !== '';
        return true;
    }, [step, data]);

    const handleNext = () => { if (step < 3) setStep((s) => (s + 1) as Step); };
    const handleBack = () => { if (step > 0) setStep((s) => (s - 1) as Step); };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            if (isEditing && editEntry) {
                const patch = {
                    firstName: data.firstName.trim(),
                    lastName: data.lastName.trim(),
                    nationality: data.nationality.trim(),
                    gender: data.gender.trim(),
                    passportNumber: data.passportNumber.trim(),
                    addressId: data.addressId,
                    addressName: data.addressName,
                    roomNumber: data.roomNumber,
                    date: format(data.date, 'yyyy-MM-dd'),
                };
                const result = await updateOdbiorZakwaterowanieAction(
                    editEntry.id,
                    editEntry.convertedToBokId ?? null,
                    patch,
                    currentUser.uid,
                );
                if (!result.success) {
                    toast({ variant: 'destructive', title: 'Błąd zapisu', description: result.error || 'Nie udało się zapisać.' });
                    return;
                }
                // Optimistic update
                patchRawOdbiorEntry(editEntry.id, patch);
                if (editEntry.convertedToBokId) {
                    patchRawBokResident(editEntry.convertedToBokId, {
                        firstName: patch.firstName,
                        lastName: patch.lastName,
                        fullName: `${patch.lastName} ${patch.firstName}`.trim(),
                        nationality: patch.nationality,
                        gender: patch.gender,
                        passportNumber: patch.passportNumber,
                        address: patch.addressName,
                        roomNumber: patch.roomNumber,
                        checkInDate: patch.date,
                    });
                }
                toast({ title: 'Zaktualizowano', description: `Dane ${data.lastName} ${data.firstName} zaktualizowane.` });
            } else {
                const result = await addOdbiorZakwaterowanieAction({
                    type: 'zakwaterowanie',
                    firstName: data.firstName.trim(),
                    lastName: data.lastName.trim(),
                    nationality: data.nationality.trim(),
                    gender: data.gender.trim(),
                    passportNumber: data.passportNumber.trim(),
                    addressId: data.addressId,
                    addressName: data.addressName,
                    roomNumber: data.roomNumber,
                    date: format(data.date, 'yyyy-MM-dd'),
                    createdBy: currentUser.name,
                    createdById: currentUser.uid,
                });
                if (!result.success) {
                    toast({ variant: 'destructive', title: 'Błąd zapisu', description: result.error || 'Nie udało się zapisać.' });
                    return;
                }
                // Optimistic update — add new entry and BOK resident immediately
                if (result.entry) addRawOdbiorEntry(result.entry);
                if (result.bokResident) addRawBokResident(result.bokResident);
                toast({ title: 'Zapisano', description: `${data.lastName} ${data.firstName} dodany do BOK.` });
            }
            onOpenChange(false);
            onSaved?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Błąd',
                description: error instanceof Error ? error.message : 'Nie udało się zapisać.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
                <StepIndicator current={step} />

                <ScrollArea className="flex-1 overflow-y-auto">
                    {step === 0 && <StepOsoba data={data} onChange={onChange} settings={settings} />}
                    {step === 1 && (
                        <StepLokalizacja
                            data={data}
                            onChange={onChange}
                            items={addressPickerItems}
                        />
                    )}
                    {step === 2 && <StepSzczegoly data={data} onChange={onChange} settings={settings} />}
                    {step === 3 && <StepPodsumowanie data={data} onEdit={(s) => setStep(s)} />}
                </ScrollArea>

                <div className="p-4 border-t bg-background flex items-center justify-between gap-3 flex-shrink-0">
                    <Button
                        variant="ghost"
                        onClick={step === 0 ? () => onOpenChange(false) : handleBack}
                        disabled={isSubmitting}
                        className="h-11 px-4 text-sm"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        {step === 0 ? 'Anuluj' : 'Wstecz'}
                    </Button>

                    {step < 3 ? (
                        <Button
                            onClick={handleNext}
                            disabled={!canProceed}
                            className="h-11 px-6 text-sm font-semibold"
                        >
                            Dalej
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="h-11 px-6 text-sm font-semibold"
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Check className="w-4 h-4 mr-2" />
                            {isEditing ? 'Zapisz zmiany' : 'Zatwierdź'}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
