"use client";

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n';
import { useMainLayout } from '@/components/main-layout';
import { OcrCameraButton } from '@/components/wizard-utils';
import type { Candidate } from '@/types';
import type { OcrResult } from '@/components/wizard-utils';
import { Loader2 } from 'lucide-react';
import { addCandidateAction } from '@/lib/actions';

interface AddCandidateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceOdbiorId?: string | null;
    onSaved?: (candidate: Candidate) => void;
    prefillFirstName?: string;
    prefillLastName?: string;
    prefillPassportNumber?: string;
}

export default function AddCandidateDialog({
    open,
    onOpenChange,
    sourceOdbiorId,
    onSaved,
    prefillFirstName,
    prefillLastName,
    prefillPassportNumber,
}: AddCandidateDialogProps) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { settings } = useMainLayout();

    const [firstName, setFirstName] = useState(prefillFirstName || '');
    const [lastName, setLastName] = useState(prefillLastName || '');
    const [passportNumber, setPassportNumber] = useState(prefillPassportNumber || '');
    const [saving, setSaving] = useState(false);

    React.useEffect(() => {
        setFirstName(prefillFirstName || '');
        setLastName(prefillLastName || '');
        setPassportNumber(prefillPassportNumber || '');
    }, [prefillFirstName, prefillLastName, prefillPassportNumber]);

    const handleOcrResult = (result: OcrResult) => {
        if (result.firstName) setFirstName(result.firstName);
        if (result.lastName) setLastName(result.lastName);
        if (result.passportNumber) setPassportNumber(result.passportNumber);
    };

    const handleSave = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            toast({
                variant: 'destructive',
                title: t('common.error'),
                description: 'Imię i nazwisko są wymagane.',
            });
            return;
        }
        setSaving(true);
        try {
            const res = await addCandidateAction({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                passportNumber: passportNumber.trim(),
                sourceOdbiorId: sourceOdbiorId || null,
            });
            if (res.success) {
                toast({ title: t('candidate.saved') });
                setFirstName('');
                setLastName('');
                setPassportNumber('');
                onSaved?.(res.candidate!);
                onOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: t('common.error'), description: res.error });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: t('common.error'), description: String(e) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('candidate.title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <OcrCameraButton
                            settings={settings}
                            onResult={handleOcrResult}
                            disabled={saving}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">{t('candidate.firstName')} *</Label>
                            <Input
                                className="h-9 text-sm"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                disabled={saving}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">{t('candidate.lastName')} *</Label>
                            <Input
                                className="h-9 text-sm"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                disabled={saving}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">{t('candidate.passportNumber')}</Label>
                        <Input
                            className="h-9 text-sm"
                            value={passportNumber}
                            onChange={(e) => setPassportNumber(e.target.value)}
                            disabled={saving}
                        />
                    </div>
                    <Button
                        className="w-full"
                        onClick={handleSave}
                        disabled={saving || !firstName.trim() || !lastName.trim()}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {t('candidate.save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
