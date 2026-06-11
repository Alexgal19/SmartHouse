'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { SessionData, OdbiorZgloszenie } from '@/types';
import { useToast } from '@/hooks/use-toast';
import OdbiorDetailDialog from '@/components/dialogs/odbior-detail-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Eye, ImagePlus, Minus, Plus, FileText, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { useViewPersistence } from '@/hooks/use-view-persistence';

const INITIAL_STATS = { dostarczone: 0, wTrakcie: 0, nieprzyjete: 0 };
const INITIAL_SUBMISSIONS: { id: string; status: string; date: string; from: string; persons: number; recruiter: string }[] = [];

const STATUS_STYLES: Record<string, string> = {
    'Dostarczone': 'text-success bg-green-50 border border-green-200',
    'W trakcie':   'text-amber-600 bg-amber-50 border border-amber-200',
    'Nieprzyjęte': 'text-destructive bg-red-50 border border-red-200',
    'Zakończone':  'text-success bg-green-50 border border-green-200',
};

const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = Math.round(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = Math.round(width * (MAX_HEIGHT / height));
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(file);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: file.type || 'image/jpeg', lastModified: Date.now() }));
                    } else {
                        resolve(file);
                    }
                }, file.type || 'image/jpeg', 0.7);
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
};



type FormValues = {
    phone: string;
    from: 'autobusowa' | 'pociagowa' | 'inne';
    fromComment: string;
    persons: number;
    comment: string;
    hasPermit: boolean;
    hasPesel: boolean;
    recruiterName: string;
};

// ---------- Dialog zgłoszenia ----------

function ZglosOdbiorDialog({
    open,
    onOpenChange,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSuccess: (z: OdbiorZgloszenie) => void;
}) {
    const { toast } = useToast();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const formSchema = z.object({
        phone:       z.string().min(1, t('odbior.errorRequiredPhone')).regex(/^[\d\s()+-]{6,}$/, t('odbior.errorInvalidPhone')),
        recruiterName: z.string().min(1, 'Nazwisko i imię rekrutera jest wymagane'),
        from:        z.enum(['autobusowa', 'pociagowa', 'inne'], { required_error: t('odbior.errorSelectFrom') }),
        fromComment: z.string().optional(),
        persons:     z.number().min(1, t('odbior.errorMinPersons')).max(99),
        comment:     z.string().optional(),
        hasPermit:   z.boolean().default(false),
        hasPesel:    z.boolean().default(false),
    }).superRefine((data, ctx) => {
        if (data.from === 'inne' && !data.fromComment?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t('odbior.errorFromCommentRequired'),
                path: ['fromComment'],
            });
        }
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { phone: '', recruiterName: '', from: undefined, fromComment: '', persons: 1, comment: '', hasPermit: false, hasPesel: false },
    });

    useEffect(() => {
        const urls = photoFiles.map(f => URL.createObjectURL(f));
        setPhotoPreviews(urls);
        return () => { urls.forEach(u => URL.revokeObjectURL(u)); };
    }, [photoFiles]);

    const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0) setPhotoFiles(prev => [...prev, ...files]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePhotoRemove = (idx: number) => {
        setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const onSubmit = async (values: FormValues) => {
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('numerTelefonu', values.phone);
            fd.append('rekruterNazwa', values.recruiterName);
            fd.append('skad', values.from);
            fd.append('komentarzSkad', values.fromComment ?? '');
            fd.append('iloscOsob', String(values.persons));
            fd.append('komentarz', values.comment ?? '');
            fd.append('hasPermit', String(values.hasPermit));
            fd.append('hasPesel', String(values.hasPesel));

            const compressedPhotos = await Promise.all(photoFiles.map(compressImage));
            compressedPhotos.forEach(f => fd.append('zdjecia', f));

            const res = await fetch('/api/odbior/zgloszenie', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? t('common.error'));

            toast({ title: t('odbior.submitted'), description: t('odbior.submittedDesc') });
            onSuccess(data.zgloszenie);
            onOpenChange(false);
            form.reset();
            setPhotoFiles([]);
        } catch (e) {
            toast({ variant: 'destructive', title: t('common.error'), description: e instanceof Error ? e.message : t('common.error') });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('odbior.dialogTitle')}</DialogTitle>
                    <DialogDescription className="sr-only">{t('odbior.dialogTitle')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Rekruter */}
                        <FormField control={form.control} name="recruiterName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nazwisko i imię rekrutera *</FormLabel>
                                <FormControl>
                                    <Input placeholder="Wpisz imię i nazwisko" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Telefon */}
                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('odbior.phoneLabel')}</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="+48 000 000 000"
                                        {...field}
                                        type="tel"
                                        className="w-full"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Skąd */}
                        <FormField control={form.control} name="from" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('odbior.fromLabel')}</FormLabel>
                                <FormControl>
                                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                                        <div className="flex items-center gap-2"><RadioGroupItem value="autobusowa" id="auto" /><Label htmlFor="auto">{t('odbior.busStation')}</Label></div>
                                        <div className="flex items-center gap-2"><RadioGroupItem value="pociagowa" id="poci" /><Label htmlFor="poci">{t('odbior.trainStation')}</Label></div>
                                        <div className="flex items-center gap-2"><RadioGroupItem value="inne" id="inne" /><Label htmlFor="inne">{t('odbior.other')}</Label></div>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Komentarz skąd */}
                        <FormField control={form.control} name="fromComment" render={({ field }) => {
                            const isInne = form.watch('from') === 'inne';
                            const isEmpty = !field.value?.trim();
                            const highlight = isInne && isEmpty;
                            return (
                                <FormItem>
                                    <FormLabel>
                                        {isInne ? t('odbior.fromCommentRequired') : t('odbior.fromCommentLabel')}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={t('odbior.fromCommentPlaceholder')}
                                            {...field}
                                            className={highlight ? 'border-amber-400 bg-amber-50 focus-visible:ring-amber-400' : ''}
                                        />
                                    </FormControl>
                                    {highlight && (
                                        <p className="text-xs text-amber-600 font-medium">
                                            {t('odbior.fromCommentHint')}
                                        </p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            );
                        }} />

                        {/* Ilość osób */}
                        <FormField control={form.control} name="persons" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('odbior.personsLabel')}</FormLabel>
                                <div className="flex items-center gap-3">
                                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                                        onClick={() => field.onChange(Math.max(1, field.value - 1))}>
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="w-8 text-center font-semibold">{field.value}</span>
                                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                                        onClick={() => field.onChange(Math.min(99, field.value + 1))}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Komentarz */}
                        <FormField control={form.control} name="comment" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('odbior.commentLabel')}</FormLabel>
                                <FormControl><Textarea placeholder={t('odbior.commentPlaceholder')} rows={2} {...field} /></FormControl>
                            </FormItem>
                        )} />

                        {/* Zezwolenie i PESEL */}
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('odbior.hasPermit')}</label>
                                <div className="flex gap-2">
                                    <Button type="button" variant={form.watch('hasPermit') ? 'default' : 'outline'} onClick={() => form.setValue('hasPermit', true)} className="flex-1">{t('common.yes')}</Button>
                                    <Button type="button" variant={!form.watch('hasPermit') ? 'default' : 'outline'} onClick={() => form.setValue('hasPermit', false)} className="flex-1">{t('common.no')}</Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('odbior.hasPesel')}</label>
                                <div className="flex gap-2">
                                    <Button type="button" variant={form.watch('hasPesel') ? 'default' : 'outline'} onClick={() => form.setValue('hasPesel', true)} className="flex-1">{t('common.yes')}</Button>
                                    <Button type="button" variant={!form.watch('hasPesel') ? 'default' : 'outline'} onClick={() => form.setValue('hasPesel', false)} className="flex-1">{t('common.no')}</Button>
                                </div>
                            </div>
                        </div>

                        {/* Zdjęcia */}
                        <div className="space-y-2">
                            <Label>{t('odbior.photosLabel')}</Label>
                            {photoPreviews.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {photoPreviews.map((url, i) => (
                                        <div key={i} className="relative rounded-md overflow-hidden aspect-square bg-muted">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={url} alt="" className="object-cover w-full h-full" />
                                            <button type="button"
                                                title="Usuń zdjęcie"
                                                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-black"
                                                onClick={() => handlePhotoRemove(i)}>
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Button type="button" variant="outline" className="w-full gap-2"
                                onClick={() => fileInputRef.current?.click()}>
                                <ImagePlus className="h-4 w-4" /> {t('odbior.addPhotosBtn')}
                            </Button>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} title="Dodaj zdjęcia" />
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? t('odbior.sending') : t('odbior.submitBtn')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// ---------- Główny widok ----------

interface OdbiorViewProps {
    currentUser: SessionData;
}

export default function OdbiorView({ currentUser: _currentUser }: OdbiorViewProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [stats, setStats] = useState(INITIAL_STATS);
    const [allZgloszenia, setAllZgloszenia] = useState<OdbiorZgloszenie[]>([]);
    const [submissions, setSubmissions] = useState(INITIAL_SUBMISSIONS);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedZgloszenie, setSelectedZgloszenie] = useState<OdbiorZgloszenie | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [recruiterFilter, setRecruiterFilter] = useState<string>('all');
    const { toast } = useToast();
    const { t } = useLanguage();
    
    useViewPersistence('odbior');

    const loadZgloszenia = useCallback(async () => {
        try {
            const res = await fetch('/api/odbior/zgloszenia');
            if (!res.ok) return;
            const data: OdbiorZgloszenie[] = await res.json();
            setAllZgloszenia(data);
            setSubmissions(data.map(z => ({
                id: z.id,
                status: z.status,
                date: z.dataZgloszenia,
                from: { autobusowa: t('odbior.busStation'), pociagowa: t('odbior.trainStation'), inne: t('odbior.other') }[z.skad] ?? z.skad,
                persons: z.iloscOsob,
                recruiter: z.rekruterNazwa,
            })));
            setStats({
                dostarczone: data.filter(z => z.status === 'Zakończone' || z.status === 'Dostarczone').length,
                wTrakcie: data.filter(z => z.status === 'W trakcie').length,
                nieprzyjete: data.filter(z => z.status === 'Nieprzyjęte').length,
            });
        } catch {
            toast({ variant: 'destructive', title: t('common.error'), description: t('odbior.loadError') });
        }
    }, [t, toast]);

    useEffect(() => { loadZgloszenia(); }, [loadZgloszenia]);

    const statusLabel = (status: string) => {
        const map: Record<string, string> = {
            'Nieprzyjęte': t('odbior.statusUnaccepted'),
            'W trakcie': t('odbior.statusInProgress'),
            'Zakończone': t('odbior.statusCompleted'),
            'Dostarczone': t('odbior.statusDelivered'),
        };
        return map[status] ?? status;
    };

    const handleEyeClick = (submissionId: string) => {
        const found = allZgloszenia.find(z => z.id === submissionId);
        if (found) { setSelectedZgloszenie(found); setDetailOpen(true); }
    };

    const handleStatusChange = (id: string, updates: Partial<OdbiorZgloszenie>) => {
        setAllZgloszenia(prev => {
            const updated = prev.map(z => z.id === id ? { ...z, ...updates } : z);
            setStats({
                dostarczone: updated.filter(z => z.status === 'Zakończone' || z.status === 'Dostarczone').length,
                wTrakcie: updated.filter(z => z.status === 'W trakcie').length,
                nieprzyjete: updated.filter(z => z.status === 'Nieprzyjęte').length,
            });
            return updated;
        });
        setSubmissions(prev => prev.map(s => {
            if (s.id !== id) return s;
            return { ...s, status: (updates.status ?? s.status) };
        }));
        if (selectedZgloszenie?.id === id) {
            setSelectedZgloszenie(prev => prev ? { ...prev, ...updates } : prev);
        }
        window.dispatchEvent(new CustomEvent('odbior-status-updated'));
    };

    const handleNewSubmission = (z: OdbiorZgloszenie) => {
        setAllZgloszenia(prev => [z, ...prev]);
        setSubmissions(prev => [{
            id: z.id,
            status: z.status,
            date: z.dataZgloszenia,
            from: { autobusowa: t('odbior.busStation'), pociagowa: t('odbior.trainStation'), inne: t('odbior.other') }[z.skad] ?? z.skad,
            persons: z.iloscOsob,
            recruiter: z.rekruterNazwa,
        }, ...prev]);
        setStats(prev => ({
            dostarczone: z.status === 'Zakończone' || z.status === 'Dostarczone' ? prev.dostarczone + 1 : prev.dostarczone,
            wTrakcie: z.status === 'W trakcie' ? prev.wTrakcie + 1 : prev.wTrakcie,
            nieprzyjete: z.status === 'Nieprzyjęte' ? prev.nieprzyjete + 1 : prev.nieprzyjete,
        }));
        window.dispatchEvent(new CustomEvent('odbior-status-updated'));
    };

    const uniqueRecruiters = useMemo(() =>
        [...new Set(submissions.map(s => s.recruiter).filter(Boolean))].sort(),
    [submissions]);

    const filteredSubmissions = submissions.filter(row => {
        const matchesSearch = !searchTerm.trim() ||
            row.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.recruiter.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesStatus = false;
        if (statusFilter === 'all') {
            matchesStatus = true;
        } else if (statusFilter === 'Zakończone_Dostarczone') {
            matchesStatus = row.status === 'Zakończone' || row.status === 'Dostarczone';
        } else {
            matchesStatus = row.status === statusFilter;
        }

        const matchesRecruiter = recruiterFilter === 'all' || row.recruiter === recruiterFilter;

        return matchesSearch && matchesStatus && matchesRecruiter;
    });

    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/odbior/zgloszenie/${deleteConfirmId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? t('common.error'));
            }
            const remaining = allZgloszenia.filter(z => z.id !== deleteConfirmId);
            setAllZgloszenia(remaining);
            setSubmissions(prev => prev.filter(s => s.id !== deleteConfirmId));
            setStats({
                dostarczone: remaining.filter(z => z.status === 'Zakończone' || z.status === 'Dostarczone').length,
                wTrakcie: remaining.filter(z => z.status === 'W trakcie').length,
                nieprzyjete: remaining.filter(z => z.status === 'Nieprzyjęte').length,
            });
            toast({ title: t('odbior.deleted') });
            window.dispatchEvent(new CustomEvent('odbior-status-updated'));
        } catch (e) {
            toast({ variant: 'destructive', title: t('common.error'), description: e instanceof Error ? e.message : t('common.error') });
        } finally {
            setDeleteLoading(false);
            setDeleteConfirmId(null);
        }
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Nagłówek */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('odbior.viewTitle')}</h1>
            </div>

            {/* Bloki statystyk */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Dostarczone */}
                <button 
                    type="button" 
                    onClick={() => setStatusFilter(prev => prev === 'Zakończone_Dostarczone' ? 'all' : 'Zakończone_Dostarczone')}
                    className="text-left focus:outline-none group"
                >
                    <Card className={cn(
                        "border-2 h-full transition-all group-hover:shadow-md group-active:scale-[0.98]",
                        statusFilter === 'Zakończone_Dostarczone' 
                            ? "border-green-500 bg-green-100 shadow-sm ring-2 ring-green-200 ring-offset-1" 
                            : "border-green-300 bg-green-50"
                    )}>
                        <CardContent className="p-4 space-y-1">
                            <div className="flex items-center">
                                <span className="text-sm font-semibold text-green-800">{t('odbior.delivered2')}</span>
                            </div>
                            <p className="text-3xl font-bold text-green-900">{stats.dostarczone}</p>
                            <p className="text-xs text-success-foreground">{t('odbior.allCompleted')}</p>
                        </CardContent>
                    </Card>
                </button>

                {/* W trakcie */}
                <button 
                    type="button" 
                    onClick={() => setStatusFilter(prev => prev === 'W trakcie' ? 'all' : 'W trakcie')}
                    className="text-left focus:outline-none group"
                >
                    <Card className={cn(
                        "border-2 h-full transition-all group-hover:shadow-md group-active:scale-[0.98]",
                        statusFilter === 'W trakcie' 
                            ? "border-amber-500 bg-amber-100 shadow-sm ring-2 ring-amber-200 ring-offset-1" 
                            : "border-amber-300 bg-amber-50"
                    )}>
                        <CardContent className="p-4 space-y-1">
                            <div className="flex items-center">
                                <span className="text-sm font-semibold text-amber-800">{t('odbior.inProgress2')}</span>
                            </div>
                            <p className="text-3xl font-bold text-amber-900">{stats.wTrakcie}</p>
                            <p className="text-xs text-amber-700">{t('odbior.awaitingAction')}</p>
                        </CardContent>
                    </Card>
                </button>

                {/* Nieprzyjęte */}
                <button 
                    type="button" 
                    onClick={() => setStatusFilter(prev => prev === 'Nieprzyjęte' ? 'all' : 'Nieprzyjęte')}
                    className="text-left focus:outline-none group"
                >
                    <Card className={cn(
                        "border-2 h-full transition-all group-hover:shadow-md group-active:scale-[0.98]",
                        statusFilter === 'Nieprzyjęte' 
                            ? "border-red-500 bg-red-100 shadow-sm ring-2 ring-red-200 ring-offset-1" 
                            : "border-red-300 bg-red-50"
                    )}>
                        <CardContent className="p-4 space-y-1">
                            <div className="flex items-center">
                                <span className="text-sm font-semibold text-red-800">{t('odbior.statusUnaccepted')}</span>
                            </div>
                            <p className="text-3xl font-bold text-red-900">{stats.nieprzyjete}</p>
                            <p className="text-xs text-red-700">{t('odbior.unacceptedDesc')}</p>
                        </CardContent>
                    </Card>
                </button>

                {/* Nowe zgłoszenie CTA */}
                <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="text-left focus:outline-none group"
                >
                    <Card className="border-2 border-violet-400 bg-violet-50 h-full transition-all group-hover:shadow-md group-active:scale-[0.98]">
                        <CardContent className="p-4 flex flex-col items-center justify-center gap-2 h-full min-h-[100px]">
                            <div className="flex items-center self-start">
                                <span className="text-sm font-semibold text-violet-800">{t('odbior.newSubmission')}</span>
                            </div>
                            <FileText className="h-8 w-8 text-violet-400 mt-1" />
                            <span className="text-sm font-bold text-violet-700">{t('odbior.submitReception')}</span>
                        </CardContent>
                    </Card>
                </button>
            </div>

            {/* Tabela zgłoszeń */}
            <div className="space-y-3">
                <h2 className="text-base font-semibold">{t('odbior.recentRequests')}</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder={t('odbior.searchPlaceholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="sm:w-72"
                    />
                    <select
                        title="Status"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring sm:w-48"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="all">{t('odbior.filterAll')}</option>
                        <option value="Nieprzyjęte">{t('odbior.statusUnaccepted')}</option>
                        <option value="W trakcie">{t('odbior.statusInProgress')}</option>
                        <option value="Zakończone_Dostarczone">{t('odbior.statusCompleted')}</option>
                    </select>
                    <select
                        title={t('odbior.filterRecruiter')}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring sm:w-56"
                        value={recruiterFilter}
                        onChange={e => setRecruiterFilter(e.target.value)}
                    >
                        <option value="all">{t('odbior.filterAllRecruiters')}</option>
                        {uniqueRecruiters.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                    {filteredSubmissions.length === 0 ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                            {t('odbior.noSubmissions')}
                        </div>
                    ) : filteredSubmissions.map((row) => (
                        <Card key={row.id} className="overflow-hidden" data-testid={`odbior-row-${row.id}`}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                                        STATUS_STYLES[row.status] ?? 'text-gray-600 bg-gray-50 border border-gray-200'
                                    )}>
                                        {statusLabel(row.status)}
                                    </span>
                                    <span className="text-xs text-gray-500">{row.date}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-500">{t('odbior.fromHeader')}</p>
                                        <p className="font-medium">{row.from}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('odbior.personsHeader')}</p>
                                        <p className="font-medium">{row.persons}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs text-gray-500">{t('odbior.recruiterHeader')}</p>
                                        <p className="font-medium">{row.recruiter}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-9"
                                        aria-label={t('odbior.details')}
                                        onClick={() => handleEyeClick(row.id)}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        {t('odbior.details')}
                                    </Button>
                                    {!_currentUser.isGuest && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 px-3 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                                            aria-label={t('common.delete')}
                                            disabled={_currentUser.isDriver}
                                            onClick={() => setDeleteConfirmId(row.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block">
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-gray-50">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-medium text-gray-500">{t('odbior.statusHeader')}</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-500">{t('odbior.dateHeader')}</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-500">{t('odbior.fromHeader')}</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-500">{t('odbior.personsHeader')}</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-500">{t('odbior.recruiterHeader')}</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-500">{t('odbior.actionsHeader')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSubmissions.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                                                    {t('odbior.noSubmissions')}
                                                </td>
                                            </tr>
                                        ) : filteredSubmissions.map((row, i) => (
                                            <tr key={row.id} data-testid={`odbior-row-${row.id}`} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-gray-50')}>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                                                        STATUS_STYLES[row.status] ?? 'text-gray-600 bg-gray-50 border border-gray-200'
                                                    )}>
                                                        {statusLabel(row.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">{row.date}</td>
                                                <td className="px-4 py-3">{row.from}</td>
                                                <td className="px-4 py-3">{row.persons}</td>
                                                <td className="px-4 py-3">{row.recruiter}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-8">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            aria-label={t('odbior.details')}
                                                            onClick={() => handleEyeClick(row.id)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {!_currentUser.isGuest && (
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                                                                aria-label={t('common.delete')}
                                                                disabled={_currentUser.isDriver}
                                                                onClick={() => setDeleteConfirmId(row.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dialog potwierdzenia usunięcia */}
            <Dialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('odbior.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('odbior.deleteDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" disabled={deleteLoading} onClick={() => setDeleteConfirmId(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="destructive" disabled={deleteLoading} onClick={handleDelete}>
                            {deleteLoading ? t('odbior.deleting') : t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ZglosOdbiorDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={handleNewSubmission} />

            {selectedZgloszenie && (
                <OdbiorDetailDialog
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                    zgloszenie={selectedZgloszenie}
                    allZgloszenia={allZgloszenia}
                    currentUser={_currentUser}
                    onStatusChange={handleStatusChange}
                />
            )}
        </div>
    );
}
