"use client";

import React, { useEffect, useMemo, useState } from 'react';
import * as z from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Check, Loader2, User, MapPin, ClipboardList, CalendarDays } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMainLayout } from '@/components/main-layout';
import type { BokResident, Settings, SessionData } from '@/types';
import { cn } from '@/lib/utils';
import {
    WizardStepIndicator, WizardDateInput, OcrCameraButton,
    WizardAddressPicker, WizardGenderPicker, buildAddressItems, type WizardAddressItem,
} from '@/components/wizard-utils';
import { EditBokResidentForm } from '@/components/edit-bok-resident-form';
import { useLanguage } from '@/lib/i18n';

export const formSchema = z.object({
    role: z.string().min(1, 'Rola jest wymagana.'),
    firstName: z.string().min(1, 'Imię jest wymagane.'),
    lastName: z.string().min(1, 'Nazwisko jest wymagane.'),
    coordinatorId: z.string().min(1, 'Koordynator jest wymagany.'),
    nationality: z.string().min(1, 'Narodowość jest wymagana.'),
    locality: z.string().optional(),
    address: z.string().optional(),
    roomNumber: z.string().optional(),
    zaklad: z.string().optional(),
    gender: z.string().min(1, 'Płeć jest wymagana.'),
    checkInDate: z.date({ required_error: 'Data zameldowania jest wymagana.' }),
    checkOutDate: z.date().nullable().optional(),
    dismissDate: z.date().nullable().optional(),
    returnStatus: z.string().optional(),
    status: z.string().optional(),
    comments: z.string().optional(),
});

export type BokResidentFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'dismissDate' | 'coordinatorId'> & {
    checkInDate: string | null;
    checkOutDate?: string | null;
    dismissDate?: string | null;
    coordinatorId: string;
};

export function AddBokResidentForm({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    resident,
    currentUser,
    onSendPush,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: BokResidentFormData) => void;
    settings: Settings;
    resident: BokResident | null;
    currentUser: SessionData;
    onSendPush?: (data: BokResidentFormData) => Promise<void>;
}) {
    if (resident) {
        return <EditBokResidentForm isOpen={isOpen} onOpenChange={onOpenChange} onSave={onSave} settings={settings} resident={resident} currentUser={currentUser} onSendPush={onSendPush} />;
    }
    return <AddBokResidentWizard isOpen={isOpen} onOpenChange={onOpenChange} onSave={onSave} settings={settings} currentUser={currentUser} />;
}

function AddBokResidentWizard({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    currentUser,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: BokResidentFormData) => void;
    settings: Settings;
    currentUser: SessionData;
}) {
    const { t, dateLocale } = useLanguage();
    const { toast } = useToast();
    const { allEmployees, allNonEmployees, allBokResidents } = useMainLayout();

    type WizardData = {
        role: string;
        firstName: string;
        lastName: string;
        nationality: string;
        passportNumber: string;
        addressName: string;
        roomNumber: string;
        coordinatorId: string;
        gender: string;
        zaklad: string;
        checkInDate: Date | null;
        checkOutDate: Date | null;
        dismissDate: Date | null;
        returnStatus: string;
        status: string;
        comments: string;
    };

    const DEFAULT: WizardData = {
        role: '', firstName: '', lastName: '', nationality: '', passportNumber: '',
        addressName: '', roomNumber: '',
        coordinatorId: '', gender: '', zaklad: '',
        checkInDate: new Date(), checkOutDate: null, dismissDate: null,
        returnStatus: '', status: 'active', comments: '',
    };

    const steps = [t('wizardStep.person'), t('wizardStep.location'), t('wizardStep.details'), t('wizardStep.dates'), t('wizardStep.summary')];
    const [step, setStep] = useState(0);
    const [data, setData] = useState<WizardData>({ ...DEFAULT });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const set = (patch: Partial<WizardData>) => setData((p) => ({ ...p, ...patch }));

    useEffect(() => {
        if (!isOpen) return;
        setStep(0);
        setData({ ...DEFAULT, coordinatorId: currentUser.isAdmin ? '' : currentUser.uid, checkInDate: new Date() });
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
    const bokRoles = useMemo(() => [...(settings.bokRoles || [])].sort((a, b) => a.localeCompare(b)), [settings.bokRoles]);
    const departmentOptions = useMemo(() => {
        if (!data.coordinatorId) return [];
        const coordinator = settings.coordinators.find((c) => c.uid === data.coordinatorId);
        return coordinator
            ? [...coordinator.departments].sort((a, b) => a.localeCompare(b)).map((d) => ({ value: d, label: d }))
            : [];
    }, [settings.coordinators, data.coordinatorId]);
    const returnOptions = useMemo(() => [...(settings.bokReturnOptions || [])].sort((a, b) => a.localeCompare(b)), [settings.bokReturnOptions]);
    const statusOptions = useMemo(() => [...(settings.statuses || [])].sort((a, b) => a.localeCompare(b)), [settings.statuses]);

    const canProceed = useMemo(() => {
        if (step === 0) return data.firstName.trim() !== '' && data.lastName.trim() !== '' && data.role !== '' && data.coordinatorId !== '' && data.nationality !== '';
        if (step === 2) return data.gender !== '';
        if (step === 3) return data.checkInDate != null && isValid(data.checkInDate);
        return true;
    }, [step, data]);

    const buildFormData = (): BokResidentFormData => ({
        role: data.role,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        nationality: data.nationality,
        gender: data.gender,
        address: data.addressName || undefined,
        roomNumber: data.roomNumber || undefined,
        zaklad: data.zaklad || undefined,
        coordinatorId: data.coordinatorId,
        checkInDate: data.checkInDate && isValid(data.checkInDate) ? format(data.checkInDate, 'yyyy-MM-dd') : null,
        checkOutDate: data.checkOutDate && isValid(data.checkOutDate) ? format(data.checkOutDate, 'yyyy-MM-dd') : null,
        dismissDate: data.dismissDate && isValid(data.dismissDate) ? format(data.dismissDate, 'yyyy-MM-dd') : null,
        returnStatus: data.returnStatus || undefined,
        status: data.status || undefined,
        comments: data.comments || undefined,
    });

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            onSave(buildFormData());
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: t('common.error'), description: e instanceof Error ? e.message : t('form.submitError') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const summaryRows = [
        { label: t('form.role'), value: data.role || '—', step: 0 },
        { label: t('form.lastName2'), value: data.lastName || '—', step: 0 },
        { label: t('form.firstName2'), value: data.firstName || '—', step: 0 },
        { label: t('form.coordinator'), value: settings.coordinators.find((c) => c.uid === data.coordinatorId)?.name || '—', step: 0 },
        { label: t('form.nationality'), value: data.nationality || '—', step: 0 },
        { label: t('form.passportNumber'), value: data.passportNumber || '—', step: 0 },
        { label: t('form.address'), value: data.addressName || '—', step: 1 },
        { label: t('form.room'), value: data.roomNumber || '—', step: 1 },
        { label: t('form.gender'), value: data.gender || '—', step: 2 },
        { label: t('form.checkIn'), value: data.checkInDate && isValid(data.checkInDate) ? format(data.checkInDate, 'd MMM yyyy', { locale: dateLocale }) : '—', step: 3 },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
                <WizardStepIndicator steps={steps} current={step} />

                <ScrollArea className="flex-1 overflow-y-auto">
                    {/* Step 0: Osoba */}
                    {step === 0 && (
                        <div className="flex flex-col gap-5 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <User className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">{t('form.person')}</h2>
                            </div>
                            <OcrCameraButton
                                settings={settings}
                                onResult={(r) => {
                                    if (r.firstName) set({ firstName: r.firstName });
                                    if (r.lastName) set({ lastName: r.lastName });
                                    if (r.nationality) set({ nationality: r.nationality });
                                    if (r.passportNumber) set({ passportNumber: r.passportNumber });
                                }}
                            />
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.role')} <span className="text-destructive">*</span></label>
                                <div className="grid grid-cols-2 gap-2">
                                    {bokRoles.filter(Boolean).map((r) => (
                                        <button key={r} type="button" onClick={() => set({ role: r })}
                                            className={cn(
                                                'rounded-xl border-2 py-3 text-sm font-semibold transition-all active:scale-95',
                                                data.role === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50 hover:bg-muted/50',
                                            )}>{r}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{t('form.lastName2')} <span className="text-destructive">*</span></label>
                                    <Input placeholder="Kowalski" value={data.lastName} onChange={(e) => set({ lastName: e.target.value })} className="h-12 text-base" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{t('form.firstName2')} <span className="text-destructive">*</span></label>
                                    <Input placeholder="Jan" value={data.firstName} onChange={(e) => set({ firstName: e.target.value })} className="h-12 text-base" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.coordinator')} <span className="text-destructive">*</span></label>
                                <Combobox options={coordOptions} value={data.coordinatorId} onChange={(v) => set({ coordinatorId: v, addressName: '', roomNumber: '', zaklad: '' })} placeholder={t('form.selectCoord')} searchPlaceholder={t('common.search')} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.nationality')} <span className="text-destructive">*</span></label>
                                <Combobox options={nationalityOptions} value={data.nationality} onChange={(v) => set({ nationality: v })} placeholder={t('form.selectNat')} searchPlaceholder={t('common.search')} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.passportNumber')}</label>
                                <Input placeholder="np. EP1234567" value={data.passportNumber} onChange={(e) => set({ passportNumber: e.target.value.toUpperCase() })} className="h-11 font-mono" />
                            </div>
                        </div>
                    )}

                    {/* Step 1: Lokalizacja */}
                    {step === 1 && (
                        <div className="flex flex-col gap-4 p-4 sm:p-6">
                            <div className="text-center space-y-1">
                                <MapPin className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">{t('form.location')}</h2>
                                <p className="text-sm text-muted-foreground">{t('form.optionalSkip')}</p>
                            </div>
                            <WizardAddressPicker
                                items={addressItems}
                                selectedAddressName={data.addressName}
                                selectedRoom={data.roomNumber}
                                onSelect={(name, room) => set({ addressName: name, roomNumber: room })}
                            />
                        </div>
                    )}

                    {/* Step 2: Szczegóły */}
                    {step === 2 && (
                        <div className="flex flex-col gap-4 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <ClipboardList className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">{t('wizardStep.details')}</h2>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.gender')} <span className="text-destructive">*</span></label>
                                <WizardGenderPicker genders={sortedGenders} value={data.gender} onChange={(g) => set({ gender: g })} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.department')}</label>
                                <Combobox options={departmentOptions} value={data.zaklad} onChange={(v) => set({ zaklad: v })} placeholder={!data.coordinatorId ? t('form.firstSelectCoord') : t('form.optionalSkip')} searchPlaceholder={t('common.search')} />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Daty */}
                    {step === 3 && (
                        <div className="flex flex-col gap-4 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <CalendarDays className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">{t('form.dates')}</h2>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.checkInDate')} <span className="text-destructive">*</span></label>
                                <WizardDateInput value={data.checkInDate} onChange={(d) => set({ checkInDate: d })} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.checkOutDate')}</label>
                                <WizardDateInput value={data.checkOutDate} onChange={(d) => set({ checkOutDate: d })} placeholder={t('form.optional')} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{t('form.returnStatus')}</label>
                                    <Select value={data.returnStatus || ''} onValueChange={(v) => set({ returnStatus: v })}>
                                        <SelectTrigger className="h-11"><SelectValue placeholder={t('form.optional')} /></SelectTrigger>
                                        <SelectContent>{returnOptions.filter(Boolean).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{t('form.status')}</label>
                                    <Select value={data.status || ''} onValueChange={(v) => set({ status: v })}>
                                        <SelectTrigger className="h-11"><SelectValue placeholder={t('form.optional')} /></SelectTrigger>
                                        <SelectContent>{statusOptions.filter(Boolean).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.comments')}</label>
                                <Input placeholder={t('form.additionalInfo')} value={data.comments} onChange={(e) => set({ comments: e.target.value })} className="h-11" />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Podsumowanie */}
                    {step === 4 && (
                        <div className="flex flex-col gap-4 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <Check className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">{t('form.summary')}</h2>
                                <p className="text-sm text-muted-foreground">{t('form.checkDataBeforeSave')}</p>
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
                            <p className="text-xs text-center text-muted-foreground">{t('form.clickRowToEdit')}</p>
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t bg-background flex items-center justify-between gap-3 flex-shrink-0">
                    <Button variant="ghost" onClick={step === 0 ? () => onOpenChange(false) : () => setStep((s) => s - 1)} disabled={isSubmitting} className="h-11 px-4 text-sm">
                        <ChevronLeft className="w-4 h-4 mr-1" />{step === 0 ? t('common.cancel') : t('form.back')}
                    </Button>
                    <div className="flex gap-2">
                        {step < steps.length - 1 ? (
                            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed} className="h-11 px-6 text-sm font-semibold">
                                {t('form.next')} <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={isSubmitting} className="h-11 px-6 text-sm font-semibold">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Check className="w-4 h-4 mr-2" />{t('common.add')}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
