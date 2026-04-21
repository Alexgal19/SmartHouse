"use client";

import React, { useEffect, useMemo, useState } from 'react';
import * as z from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Check, Loader2, User, MapPin, Briefcase, CalendarDays } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useMainLayout } from '@/components/main-layout';
import type { Employee, Settings, SessionData, DeductionReason } from '@/types';
import { cn } from '@/lib/utils';
import {
    WizardStepIndicator, WizardDateInput, OcrCameraButton,
    WizardAddressPicker, WizardGenderPicker, buildAddressItems, type WizardAddressItem,
} from '@/components/wizard-utils';
import { EditEmployeeForm } from '@/components/edit-employee-form';

// ─── Schema & types (kept for backward-compat with tests) ─────────────────────

export const formSchema = z.object({
    firstName: z.string().min(1, 'Imię jest wymagane.'),
    lastName: z.string().min(1, 'Nazwisko jest wymagane.'),
    coordinatorId: z.string().min(1, 'Koordynator jest wymagany.'),
    locality: z.string().min(1, 'Miejscowość jest wymagana.'),
    address: z.string().min(1, 'Adres jest wymagany.'),
    ownAddress: z.string().optional(),
    roomNumber: z.string(),
    zaklad: z.string().min(1, 'Zakład jest wymagany.'),
    nationality: z.string().min(1, 'Narodowość jest wymagana.'),
    gender: z.string().min(1, 'Płeć jest wymagana.'),
    checkInDate: z.date({ required_error: 'Data zameldowania jest wymagana.' }),
    checkOutDate: z.date().nullable().optional(),
    contractStartDate: z.date().nullable().optional(),
    contractEndDate: z.date().nullable().optional(),
    departureReportDate: z.date().nullable().optional(),
    comments: z.string().optional(),
    depositReturned: z.union([z.literal('Tak'), z.literal('Nie'), z.literal('Nie dotyczy')]).nullable().optional(),
    depositReturnAmount: z.number().nullable().optional(),
    deductionRegulation: z.number().nullable().optional(),
    deductionNo4Months: z.number().nullable().optional(),
    deductionNo30Days: z.number().nullable().optional(),
    deductionReason: z.array(z.object({
        id: z.string(), label: z.string(), amount: z.number().nullable(), checked: z.boolean(),
    })).optional(),
    deductionEntryDate: z.date().nullable().optional(),
});

export type EmployeeFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'contractStartDate' | 'contractEndDate' | 'departureReportDate' | 'deductionEntryDate' | 'locality'> & {
    checkInDate: string | null;
    checkOutDate?: string | null;
    contractStartDate?: string | null;
    contractEndDate?: string | null;
    departureReportDate?: string | null;
    deductionEntryDate?: string | null;
};

const DEFAULT_DEDUCTION_REASONS: DeductionReason[] = [
    { id: '1', label: 'Zgubienie kluczy', amount: null, checked: false },
    { id: '2', label: 'Zniszczenie mienia', amount: null, checked: false },
    { id: '3', label: 'Palenie w pokoju', amount: null, checked: false },
    { id: '4', label: 'Niestosowanie się do regulaminu', amount: null, checked: false },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AddEmployeeForm({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    employee,
    currentUser,
    initialData,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: EmployeeFormData) => void;
    settings: Settings;
    employee: Employee | null;
    currentUser: SessionData;
    initialData?: Partial<EmployeeFormData>;
}) {
    if (employee) {
        return <EditEmployeeForm isOpen={isOpen} onOpenChange={onOpenChange} onSave={onSave} settings={settings} employee={employee} currentUser={currentUser} initialData={initialData} />;
    }
    return <AddEmployeeWizard isOpen={isOpen} onOpenChange={onOpenChange} onSave={onSave} settings={settings} currentUser={currentUser} initialData={initialData} />;
}

function AddEmployeeWizard({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    currentUser,
    initialData,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: EmployeeFormData) => void;
    settings: Settings;
    currentUser: SessionData;
    initialData?: Partial<EmployeeFormData>;
}) {
    const { toast } = useToast();
    const { allEmployees, allNonEmployees, allBokResidents } = useMainLayout();

    type WizardData = {
        firstName: string;
        lastName: string;
        addressName: string;
        roomNumber: string;
        ownAddress: string;
        coordinatorId: string;
        nationality: string;
        gender: string;
        zaklad: string;
        checkInDate: Date | null;
        checkOutDate: Date | null;
        contractStartDate: Date | null;
        contractEndDate: Date | null;
        departureReportDate: Date | null;
        comments: string;
        depositReturned: 'Tak' | 'Nie' | 'Nie dotyczy' | null;
        depositReturnAmount: string;
        deductionRegulation: string;
        deductionNo4Months: string;
        deductionNo30Days: string;
        deductionReason: DeductionReason[];
        deductionEntryDate: Date | null;
    };

    const makeDefault = (): WizardData => ({
        firstName: '', lastName: '',
        addressName: '', roomNumber: '', ownAddress: '',
        coordinatorId: currentUser.isAdmin ? '' : currentUser.uid,
        nationality: '', gender: '', zaklad: '',
        checkInDate: new Date(), checkOutDate: null,
        contractStartDate: null, contractEndDate: null, departureReportDate: null,
        comments: '',
        depositReturned: null, depositReturnAmount: '',
        deductionRegulation: '', deductionNo4Months: '', deductionNo30Days: '',
        deductionReason: DEFAULT_DEDUCTION_REASONS.map((r) => ({ ...r })),
        deductionEntryDate: null,
    });

    const OWN_KEY = '__own__';

    const STEPS = ['Osoba', 'Lokalizacja', 'Praca', 'Daty', 'Podsumowanie'];
    const [step, setStep] = useState(0);
    const [data, setData] = useState<WizardData>(makeDefault());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const set = (patch: Partial<WizardData>) => setData((p) => ({ ...p, ...patch }));
    const isOwn = data.addressName === OWN_KEY;

    useEffect(() => {
        if (!isOpen) return;
        setStep(0);
        if (initialData) {
            const d = makeDefault();
            if (initialData.firstName) d.firstName = initialData.firstName;
            if (initialData.lastName) d.lastName = initialData.lastName;
            if (initialData.nationality) d.nationality = initialData.nationality;
            if (initialData.zaklad) d.zaklad = initialData.zaklad;
            setData(d);
        } else {
            setData(makeDefault());
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const addressItems: WizardAddressItem[] = useMemo(() => {
        const coordId = data.coordinatorId || null;
        const filtered = coordId
            ? settings.addresses.filter((a) => a.coordinatorIds.includes(coordId))
            : settings.addresses;
        return buildAddressItems(
            filtered,
            (allEmployees || []).filter((e) => e.status === 'active'),
            (allNonEmployees || []).filter((e) => e.status === 'active'),
            (allBokResidents || []).filter((b) => b.status !== 'dismissed' && !b.dismissDate && !b.sendDate),
        );
    }, [settings.addresses, allEmployees, allNonEmployees, allBokResidents, data.coordinatorId]);

    const coordOptions = useMemo(
        () => [...settings.coordinators].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.uid, label: c.name })),
        [settings.coordinators]
    );
    const nationalityOptions = useMemo(
        () => [...settings.nationalities].sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
        [settings.nationalities]
    );
    const sortedGenders = useMemo(() => [...settings.genders].sort((a, b) => a.localeCompare(b)), [settings.genders]);
    const departmentOptions = useMemo(() => {
        if (!data.coordinatorId) return [];
        const coordinator = settings.coordinators.find((c) => c.uid === data.coordinatorId);
        return coordinator
            ? [...coordinator.departments].sort((a, b) => a.localeCompare(b)).map((d) => ({ value: d, label: d }))
            : [];
    }, [settings.coordinators, data.coordinatorId]);

    const canProceed = useMemo(() => {
        if (step === 0) return data.firstName.trim() !== '' && data.lastName.trim() !== '' && data.coordinatorId !== '' && data.nationality !== '';
        if (step === 1) return isOwn ? true : data.addressName !== '' && data.roomNumber !== '';
        if (step === 2) return data.gender !== '' && data.zaklad !== '';
        if (step === 3) return data.checkInDate != null && isValid(data.checkInDate);
        return true;
    }, [step, data, isOwn]);

    const fmt = (d: Date | null | undefined): string | null =>
        d && isValid(d) ? format(d, 'yyyy-MM-dd') : null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const formData: EmployeeFormData = {
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
                coordinatorId: data.coordinatorId,
                address: isOwn ? 'Własne mieszkanie' : data.addressName,
                ownAddress: isOwn ? data.ownAddress : undefined,
                roomNumber: isOwn ? '' : data.roomNumber,
                zaklad: data.zaklad,
                nationality: data.nationality,
                gender: data.gender,
                checkInDate: fmt(data.checkInDate),
                checkOutDate: fmt(data.checkOutDate),
                contractStartDate: fmt(data.contractStartDate),
                contractEndDate: fmt(data.contractEndDate),
                departureReportDate: fmt(data.departureReportDate),
                deductionEntryDate: fmt(data.deductionEntryDate),
                comments: data.comments || undefined,
                depositReturned: data.depositReturned ?? undefined,
                depositReturnAmount: data.depositReturnAmount !== '' ? Number(data.depositReturnAmount) : null,
                deductionRegulation: data.deductionRegulation !== '' ? Number(data.deductionRegulation) : null,
                deductionNo4Months: data.deductionNo4Months !== '' ? Number(data.deductionNo4Months) : null,
                deductionNo30Days: data.deductionNo30Days !== '' ? Number(data.deductionNo30Days) : null,
                deductionReason: data.deductionReason,
            };
            onSave(formData);
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Błąd', description: e instanceof Error ? e.message : 'Nie udało się zapisać.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const summaryRows = [
        { label: 'Nazwisko', value: data.lastName || '—', step: 0 },
        { label: 'Imię', value: data.firstName || '—', step: 0 },
        { label: 'Narodowość', value: data.nationality || '—', step: 0 },
        { label: 'Koordynator', value: settings.coordinators.find((c) => c.uid === data.coordinatorId)?.name || '—', step: 0 },
        { label: 'Adres', value: isOwn ? `Własne: ${data.ownAddress || '—'}` : data.addressName || '—', step: 1 },
        { label: 'Pokój', value: isOwn ? 'N/A' : data.roomNumber || '—', step: 1 },
        { label: 'Zakład', value: data.zaklad || '—', step: 2 },
        { label: 'Płeć', value: data.gender || '—', step: 2 },
        { label: 'Zameldowanie', value: fmt(data.checkInDate) ?? '—', step: 3 },
        { label: 'Umowa od', value: fmt(data.contractStartDate) ?? '—', step: 3 },
        { label: 'Umowa do', value: fmt(data.contractEndDate) ?? '—', step: 3 },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
                <WizardStepIndicator steps={STEPS} current={step} />

                <ScrollArea className="flex-1 overflow-y-auto">
                    {/* Step 0: Osoba */}
                    {step === 0 && (
                        <div className="flex flex-col gap-5 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <User className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">Dane osoby</h2>
                            </div>
                            <OcrCameraButton
                                settings={settings}
                                onResult={(r) => {
                                    if (r.firstName) set({ firstName: r.firstName });
                                    if (r.lastName) set({ lastName: r.lastName });
                                    if (r.nationality) set({ nationality: r.nationality });
                                }}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Nazwisko <span className="text-destructive">*</span></label>
                                    <Input placeholder="Kowalski" value={data.lastName} onChange={(e) => set({ lastName: e.target.value })} className="h-12 text-base" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Imię <span className="text-destructive">*</span></label>
                                    <Input placeholder="Jan" value={data.firstName} onChange={(e) => set({ firstName: e.target.value })} className="h-12 text-base" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Koordynator <span className="text-destructive">*</span></label>
                                <Combobox options={coordOptions} value={data.coordinatorId} onChange={(v) => set({ coordinatorId: v, addressName: '', roomNumber: '', ownAddress: '', zaklad: '' })} placeholder="Wybierz koordynatora" searchPlaceholder="Szukaj..." />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Narodowość <span className="text-destructive">*</span></label>
                                <Combobox options={nationalityOptions} value={data.nationality} onChange={(v) => set({ nationality: v })} placeholder="Wybierz narodowość" searchPlaceholder="Szukaj..." />
                            </div>
                        </div>
                    )}

                    {/* Step 1: Lokalizacja */}
                    {step === 1 && (
                        <div className="flex flex-col gap-4 p-4 sm:p-6">
                            <div className="text-center space-y-1">
                                <MapPin className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">Lokalizacja</h2>
                                <p className="text-sm text-muted-foreground">Wybierz adres i pokój</p>
                            </div>
                            <WizardAddressPicker
                                items={addressItems}
                                selectedAddressName={data.addressName}
                                selectedRoom={data.roomNumber}
                                onSelect={(name, room) => set({ addressName: name, roomNumber: room, ownAddress: '' })}
                                allowOwnAddress
                                ownAddressValue={data.ownAddress}
                                onOwnAddressChange={(v) => set({ ownAddress: v })}
                            />
                        </div>
                    )}

                    {/* Step 2: Praca */}
                    {step === 2 && (
                        <div className="flex flex-col gap-4 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <Briefcase className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">Praca</h2>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Zakład <span className="text-destructive">*</span></label>
                                <Combobox options={departmentOptions} value={data.zaklad} onChange={(v) => set({ zaklad: v })} placeholder={!data.coordinatorId ? 'Najpierw wybierz koordynatora' : 'Wybierz zakład'} searchPlaceholder="Szukaj..." />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Płeć <span className="text-destructive">*</span></label>
                                <WizardGenderPicker genders={sortedGenders} value={data.gender} onChange={(g) => set({ gender: g })} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Komentarze</label>
                                <Input placeholder="Dodatkowe informacje..." value={data.comments} onChange={(e) => set({ comments: e.target.value })} className="h-11" />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Daty */}
                    {step === 3 && (
                        <div className="flex flex-col gap-4 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <CalendarDays className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">Daty</h2>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Data zameldowania <span className="text-destructive">*</span></label>
                                <WizardDateInput value={data.checkInDate} onChange={(d) => set({ checkInDate: d })} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Data wymeldowania</label>
                                <WizardDateInput value={data.checkOutDate} onChange={(d) => set({ checkOutDate: d })} placeholder="Opcjonalnie" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Umowa od</label>
                                    <WizardDateInput value={data.contractStartDate} onChange={(d) => set({ contractStartDate: d })} placeholder="Opcjonalnie" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Umowa do</label>
                                    <WizardDateInput value={data.contractEndDate} onChange={(d) => set({ contractEndDate: d })} placeholder="Opcjonalnie" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Data zgłoszenia wyjazdu</label>
                                <WizardDateInput value={data.departureReportDate} onChange={(d) => set({ departureReportDate: d })} placeholder="Opcjonalnie" />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Podsumowanie */}
                    {step === 4 && (
                        <div className="flex flex-col gap-4 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <Check className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">Podsumowanie</h2>
                            </div>
                            <div className="rounded-xl border divide-y">
                                {summaryRows.map(({ label, value, step: s }) => (
                                    <div key={label} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 cursor-pointer group" onClick={() => setStep(s)}>
                                        <div>
                                            <div className="text-xs text-muted-foreground">{label}</div>
                                            <div className="text-sm font-medium">{value}</div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t bg-background flex items-center justify-between gap-3 flex-shrink-0">
                    <Button variant="ghost" onClick={step === 0 ? () => onOpenChange(false) : () => setStep((s) => s - 1)} disabled={isSubmitting} className="h-11 px-4 text-sm">
                        <ChevronLeft className="w-4 h-4 mr-1" />{step === 0 ? 'Anuluj' : 'Wstecz'}
                    </Button>
                    {step < STEPS.length - 1 ? (
                        <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed} className="h-11 px-6 text-sm font-semibold">
                            Dalej <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="h-11 px-6 text-sm font-semibold">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Check className="w-4 h-4 mr-2" />Dodaj pracownika
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
