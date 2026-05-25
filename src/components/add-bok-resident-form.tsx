"use client";

import React, { useEffect, useMemo, useState } from 'react';
import * as z from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/ui/combobox';
import { ChevronLeft, ChevronRight, Check, Loader2, User, MapPin, CalendarDays } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMainLayout } from '@/components/main-layout';
import type { BokResident, Settings, SessionData } from '@/types';
import {
    WizardStepIndicator, WizardDateInput, OcrCameraButton,
    WizardAddressPicker, WizardGenderPicker, buildAddressItems, type WizardAddressItem,
} from '@/components/wizard-utils';
import { EditBokResidentForm, type BokResidentFormData } from '@/components/edit-bok-resident-form';
import { useLanguage } from '@/lib/i18n';

export function AddBokResidentForm({
    isOpen,
    onOpenChange,
    onSave,
    onDismiss,
    onDelete,
    settings,
    resident,
    currentUser,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: BokResidentFormData) => void;
    onDismiss?: (id: string, checkOutDate: Date) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    settings: Settings;
    resident: BokResident | null;
    currentUser: SessionData;
}) {
    if (resident) {
        return (
            <EditBokResidentForm
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                onSave={onSave}
                onDismiss={onDismiss}
                onDelete={onDelete}
                settings={settings}
                resident={resident}
                currentUser={currentUser}
            />
        );
    }
    return (
        <AddBokResidentWizard
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            onSave={onSave}
            settings={settings}
            currentUser={currentUser}
        />
    );
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
    const { t } = useLanguage();
    const { toast } = useToast();
    const { allEmployees, allNonEmployees, allBokResidents } = useMainLayout();

    type WizardData = {
        firstName: string;
        lastName: string;
        nationality: string;
        gender: string;
        passportNumber: string;
        locality: string;
        addressName: string;
        roomNumber: string;
        checkInDate: Date | null;
        checkOutDate: Date | null;
        comments: string;
    };

    const makeDefault = (): WizardData => ({
        firstName: '',
        lastName: '',
        nationality: '',
        gender: '',
        passportNumber: '',
        locality: 'MIESZKANIA TYMCZASOWE',
        addressName: '',
        roomNumber: '',
        checkInDate: new Date(),
        checkOutDate: null,
        comments: '',
    });

    const steps = [
        t('wizardStep.person'),
        t('wizardStep.location'),
        t('wizardStep.dates'),
        t('form.summary')
    ];
    const [step, setStep] = useState(0);
    const [data, setData] = useState<WizardData>(makeDefault());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const set = (patch: Partial<WizardData>) => setData((p) => ({ ...p, ...patch }));

    useEffect(() => {
        if (!isOpen) return;
        setStep(0);
        setData(makeDefault());
    }, [isOpen]);

    const addressItems: WizardAddressItem[] = useMemo(() => {
        const bokAddresses = settings.addresses.filter(a => a.locality === 'MIESZKANIA TYMCZASOWE');
        return buildAddressItems(
            bokAddresses,
            (allEmployees || []).filter((e) => e.status === 'active'),
            (allNonEmployees || []).filter((e) => e.status === 'active'),
            (allBokResidents || []).filter((e) => e.status !== 'dismissed'),
        );
    }, [settings.addresses, allEmployees, allNonEmployees, allBokResidents]);

    const nationalityOptions = useMemo(
        () => [...settings.nationalities].sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
        [settings.nationalities]
    );

    const sortedGenders = useMemo(() => [...settings.genders].sort((a, b) => a.localeCompare(b)), [settings.genders]);

    const canProceed = useMemo(() => {
        if (step === 0) {
            return (
                data.firstName.trim() !== '' &&
                data.lastName.trim() !== '' &&
                data.nationality !== '' &&
                data.gender !== ''
            );
        }
        if (step === 1) {
            // Location is optional for BOK, but if selected, room must also be selected
            return data.addressName === '' || (data.addressName !== '' && data.roomNumber !== '');
        }
        if (step === 2) {
            return data.checkInDate != null && isValid(data.checkInDate);
        }
        return true;
    }, [step, data]);

    const fmt = (d: Date | null | undefined): string | null =>
        d && isValid(d) ? format(d, 'yyyy-MM-dd') : null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Resolve locality for summary and save
            const selectedAddress = settings.addresses.find(a => a.name === data.addressName);
            const resolvedLocality = selectedAddress?.locality || data.locality;

            const formData: BokResidentFormData = {
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
                nationality: data.nationality,
                gender: data.gender,
                passportNumber: data.passportNumber || undefined,
                locality: resolvedLocality || undefined,
                address: data.addressName || undefined,
                roomNumber: data.roomNumber || undefined,
                checkInDate: fmt(data.checkInDate),
                checkOutDate: fmt(data.checkOutDate),
                comments: data.comments || undefined,
                status: "active",
            };

            await onSave(formData);
            onOpenChange(false);
        } catch (e) {
            toast({
                variant: 'destructive',
                title: t('common.error'),
                description: e instanceof Error ? e.message : t('form.submitError')
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const summaryRows = [
        { label: t('form.lastName2'), value: data.lastName || '—', step: 0 },
        { label: t('form.firstName2'), value: data.firstName || '—', step: 0 },
        { label: t('form.nationality'), value: data.nationality || '—', step: 0 },
        { label: t('form.gender'), value: data.gender || '—', step: 0 },
        { label: t('form.passportNumber'), value: data.passportNumber || '—', step: 0 },
        { label: t('form.address'), value: data.addressName || '—', step: 1 },
        { label: t('form.room'), value: data.roomNumber || '—', step: 1 },
        { label: t('form.checkIn'), value: fmt(data.checkInDate) ?? '—', step: 2 },
        { label: t('form.checkOutDate'), value: fmt(data.checkOutDate) ?? '—', step: 2 },
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
                                <label className="text-sm font-medium">{t('form.nationality')} <span className="text-destructive">*</span></label>
                                <Combobox options={nationalityOptions} value={data.nationality} onChange={(v) => set({ nationality: v })} placeholder={t('form.selectNationality')} searchPlaceholder={t('common.search')} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.gender')} <span className="text-destructive">*</span></label>
                                <WizardGenderPicker genders={sortedGenders} value={data.gender} onChange={(g) => set({ gender: g })} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">{t('form.passportNumber')}</label>
                                <Input placeholder={t('form.passportNumberPlaceholder')} value={data.passportNumber} onChange={(e) => set({ passportNumber: e.target.value })} className="h-12 text-base" />
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
                                allowOwnAddress={false}
                            />
                        </div>
                    )}

                    {/* Step 2: Daty i uwagi */}
                    {step === 2 && (
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
                                <label className="text-sm font-medium">{t('form.comments')}</label>
                                <Input placeholder={t('form.additionalInfo')} value={data.comments} onChange={(e) => set({ comments: e.target.value })} className="h-11" />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Podsumowanie */}
                    {step === 3 && (
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
                            <Check className="w-4 h-4 mr-2" />{t('form.addBokResident')}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
