"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/ui/combobox';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Check, Loader2, User, MapPin, ClipboardList, CalendarDays } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMainLayout } from '@/components/main-layout';
import type { NonEmployee, Settings, SessionData } from '@/types';
import { cn } from '@/lib/utils';
import {
    WizardStepIndicator, WizardDateInput, OcrCameraButton,
    WizardAddressPicker, WizardGenderPicker, buildAddressItems, type WizardAddressItem,
} from '@/components/wizard-utils';
import { EditNonEmployeeForm } from '@/components/edit-non-employee-form';
import { useLanguage } from '@/lib/i18n';

type NonEmployeeFormData = Omit<NonEmployee, 'id' | 'status'>;

export function AddNonEmployeeForm({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    nonEmployee,
    currentUser,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: NonEmployeeFormData) => void;
    settings: Settings;
    nonEmployee: NonEmployee | null;
    currentUser: SessionData;
}) {
    if (nonEmployee) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <EditNonEmployeeForm isOpen={isOpen} onOpenChange={onOpenChange} onSave={onSave as any} settings={settings} nonEmployee={nonEmployee} currentUser={currentUser} />;
    }
    return <AddNonEmployeeWizard isOpen={isOpen} onOpenChange={onOpenChange} onSave={onSave} settings={settings} currentUser={currentUser} />;
}

function AddNonEmployeeWizard({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    currentUser,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: NonEmployeeFormData) => void;
    settings: Settings;
    currentUser: SessionData;
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
        paymentType: string;
        paymentAmount: string;
        checkInDate: Date | null;
        checkOutDate: Date | null;
        departureReportDate: Date | null;
        comments: string;
    };

    const { t, dateLocale } = useLanguage();

    const DEFAULT: WizardData = {
        firstName: '', lastName: '',
        addressName: '', roomNumber: '', ownAddress: '',
        coordinatorId: '', nationality: '', gender: '',
        paymentType: '', paymentAmount: '',
        checkInDate: new Date(), checkOutDate: null,
        departureReportDate: null, comments: '',
    };

    const steps = [t('wizardStep.person'), t('wizardStep.location'), t('wizardStep.details'), t('wizardStep.dates'), t('wizardStep.summary')];
    const [step, setStep] = useState(0);
    const [data, setData] = useState<WizardData>({ ...DEFAULT });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const set = (patch: Partial<WizardData>) => setData((p) => ({ ...p, ...patch }));

    const OWN_KEY = '__own__';
    const isOwn = data.addressName === OWN_KEY;

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
    const paymentTypeOptions = useMemo(
        () => [...(settings.paymentTypesNZ || [])].sort((a, b) => a.localeCompare(b)).map((p) => ({ value: p, label: p })),
        [settings.paymentTypesNZ]
    );

    const canProceed = useMemo(() => {
        if (step === 0) return data.firstName.trim() !== '' && data.lastName.trim() !== '' && data.coordinatorId !== '' && data.nationality !== '';
        if (step === 1) return isOwn ? true : data.addressName !== '' && data.roomNumber !== '';
        if (step === 2) return data.gender !== '';
        if (step === 3) return data.checkInDate != null && isValid(data.checkInDate);
        return true;
    }, [step, data, isOwn]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const fmt = (d: Date | null) => (d && isValid(d) ? format(d, 'yyyy-MM-dd') : null);
            const formData: NonEmployeeFormData = {
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
                fullName: `${data.lastName.trim()} ${data.firstName.trim()}`.trim(),
                coordinatorId: data.coordinatorId,
                nationality: data.nationality,
                gender: data.gender,
                address: isOwn ? 'Własne mieszkanie' : data.addressName,
                roomNumber: isOwn ? '' : data.roomNumber,
                checkInDate: fmt(data.checkInDate),
                checkOutDate: fmt(data.checkOutDate),
                departureReportDate: fmt(data.departureReportDate),
                comments: data.comments || null,
                paymentType: data.paymentType || null,
                paymentAmount: data.paymentAmount !== '' ? Number(data.paymentAmount) : null,
            };
            onSave(formData);
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: t('common.error'), description: e instanceof Error ? e.message : t('form.submitError') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const summaryRows = [
        { label: t('form.lastName2'), value: data.lastName, step: 0 },
        { label: t('form.firstName2'), value: data.firstName, step: 0 },
        { label: t('form.nationality'), value: data.nationality || '—', step: 0 },
        { label: t('form.coordinator'), value: settings.coordinators.find((c) => c.uid === data.coordinatorId)?.name || '—', step: 0 },
        { label: t('form.address'), value: isOwn ? `${t('form.ownHousing')}: ${data.ownAddress || '—'}` : data.addressName || '—', step: 1 },
        { label: t('form.room'), value: isOwn ? 'N/A' : data.roomNumber || '—', step: 1 },
        { label: t('form.gender'), value: data.gender || '—', step: 2 },
        { label: t('form.paymentType'), value: data.paymentType ? `${data.paymentType}${data.paymentAmount ? ' · ' + data.paymentAmount + ' zł' : ''}` : '—', step: 2 },
        { label: t('form.checkIn'), value: data.checkInDate && isValid(data.checkInDate) ? format(data.checkInDate, 'd MMM yyyy', { locale: dateLocale }) : '—', step: 3 },
        { label: t('form.checkOut'), value: data.checkOutDate && isValid(data.checkOutDate) ? format(data.checkOutDate, 'd MMM yyyy', { locale: dateLocale }) : '—', step: 3 },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent data-testid="add-non-employee-dialog" className="max-w-[95vw] sm:max-w-lg h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
                <WizardStepIndicator steps={steps} current={step} />

                <ScrollArea className="flex-1 overflow-y-auto">
                    {/* Step 0: Osoba */}
                    {step === 0 && (
                        <div className="flex flex-col gap-5 p-6 sm:p-8">
                            <div className="text-center space-y-1">
                                <User className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">{t('form.person')}</h2>
                                <p className="text-sm text-muted-foreground">{t('form.enterManuallyOrScan')}</p>
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
                                <Combobox options={coordOptions} value={data.coordinatorId} onChange={(v) => set({ coordinatorId: v, addressName: '', roomNumber: '' })} placeholder={t('form.selectCoord')} searchPlaceholder={t('common.search')} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.nationality')} <span className="text-destructive">*</span></label>
                                <Combobox options={nationalityOptions} value={data.nationality} onChange={(v) => set({ nationality: v })} placeholder={t('form.selectNat')} searchPlaceholder={t('common.search')} />
                            </div>
                        </div>
                    )}

                    {/* Step 1: Lokalizacja */}
                    {step === 1 && (
                        <div className="flex flex-col gap-4 p-4 sm:p-6">
                            <div className="text-center space-y-1">
                                <MapPin className="w-9 h-9 mx-auto text-primary" />
                                <h2 className="text-xl font-bold">{t('form.location')}</h2>
                                <p className="text-sm text-muted-foreground">{t('form.selectAddressRoom')}</p>
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{t('form.paymentType')}</label>
                                    <Select value={data.paymentType || ''} onValueChange={(v) => set({ paymentType: v })}>
                                        <SelectTrigger className="h-11"><SelectValue placeholder={t('form.optionalSkip')} /></SelectTrigger>
                                        <SelectContent>
                                            {paymentTypeOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{t('form.amount')} (PLN)</label>
                                    <Input type="number" placeholder="0.00" value={data.paymentAmount} onChange={(e) => set({ paymentAmount: e.target.value })} className="h-11" />
                                </div>
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
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.departureDate')}</label>
                                <WizardDateInput value={data.departureReportDate} onChange={(d) => set({ departureReportDate: d })} placeholder={t('form.optional')} />
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
            </DialogContent>
        </Dialog>
    );
}
