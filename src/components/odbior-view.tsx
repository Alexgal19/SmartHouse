'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { SessionData, OdbiorZgloszenie } from '@/types';
import { useToast } from '@/hooks/use-toast';
import OdbiorDetailDialog from '@/components/odbior-detail-dialog';
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

const INITIAL_STATS = { dostarczone: 0, wTrakcie: 0 };
const INITIAL_SUBMISSIONS: { id: string; status: string; date: string; from: string; persons: number; recruiter: string }[] = [];

const STATUS_STYLES: Record<string, string> = {
    'Dostarczone': 'text-success bg-green-50 border border-green-200',
    'W trakcie':   'text-amber-600 bg-amber-50 border border-amber-200',
    'Nieprzyjęte': 'text-destructive bg-red-50 border border-red-200',
    'Zakończone':  'text-success bg-green-50 border border-green-200',
};

type FormValues = {
    phone: string;
    from: 'autobusowa' | 'pociagowa' | 'inne';
    fromComment: string;
    persons: number;
    comment: string;
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
        phone:       z.string().min(1, t('odbior.errorRequiredPhone')),
        from:        z.enum(['autobusowa', 'pociagowa', 'inne'], { required_error: t('odbior.errorSelectFrom') }),
        fromComment: z.string().optional(),
        persons:     z.number().min(1, t('odbior.errorMinPersons')).max(99),
        comment:     z.string().optional(),
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
        defaultValues: { phone: '', from: undefined, fromComment: '', persons: 1, comment: '' },
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
            fd.append('skad', values.from);
            fd.append('komentarzSkad', values.fromComment ?? '');
            fd.append('iloscOsob', String(values.persons));
            fd.append('komentarz', values.comment ?? '');
            photoFiles.forEach(f => fd.append('zdjecia', f));

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
            <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('odbior.dialogTitle')}</DialogTitle>
                    <DialogDescription className="sr-only">{t('odbior.dialogTitle')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Telefon */}
                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('odbior.phoneLabel')}</FormLabel>
                                <FormControl><Input placeholder="+48 000 000 000" {...field} /></FormControl>
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

                        {/* Zdjęcia */}
                        <div className="space-y-2">
                            <Label>{t('odbior.photosLabel')}</Label>
                            {photoPreviews.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {photoPreviews.map((url, i) => (
                                        <div key={i} className="relative rounded-md overflow-hidden aspect-square bg-muted">
                                            <img src={url} alt="" className="object-cover w-full h-full" />
                                            <button type="button"
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
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
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
    const { toast } = useToast();
    const { t } = useLanguage();

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
            });
        } catch {
            // ciche — brak danych nie blokuje widoku
        }
    }, [t]);

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
        setAllZgloszenia(prev => prev.map(z => z.id === id ? { ...z, ...updates } : z));
        setSubmissions(prev => prev.map(s => {
            if (s.id !== id) return s;
            return { ...s, status: (updates.status ?? s.status) };
        }));
        setStats(prev => {
            const updated = allZgloszenia.map(z => z.id === id ? { ...z, ...updates } : z);
            return {
                dostarczone: updated.filter(z => z.status === 'Zakończone' || z.status === 'Dostarczone').length,
                wTrakcie: updated.filter(z => z.status === 'W trakcie').length,
            };
        });
        if (selectedZgloszenie?.id === id) {
            setSelectedZgloszenie(prev => prev ? { ...prev, ...updates } : prev);
        }
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
        setStats(prev => ({ ...prev }));
    };

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
            });
            toast({ title: t('odbior.deleted') });
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Dostarczone */}
                <Card className="border-2 border-green-300 bg-green-50">
                    <CardContent className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-white text-xs font-bold shrink-0">1</span>
                            <span className="text-sm font-semibold text-green-800">{t('odbior.delivered2')}</span>
                        </div>
                        <p className="text-3xl font-bold text-green-900 pl-8">{stats.dostarczone}</p>
                        <p className="text-xs text-success-foreground pl-8">{t('odbior.allCompleted')}</p>
                    </CardContent>
                </Card>

                {/* W trakcie */}
                <Card className="border-2 border-amber-300 bg-amber-50">
                    <CardContent className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white text-xs font-bold shrink-0">2</span>
                            <span className="text-sm font-semibold text-amber-800">{t('odbior.inProgress2')}</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-900 pl-8">{stats.wTrakcie}</p>
                        <p className="text-xs text-amber-700 pl-8">{t('odbior.awaitingAction')}</p>
                    </CardContent>
                </Card>

                {/* Nowe zgłoszenie CTA */}
                <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="text-left focus:outline-none group"
                >
                    <Card className="border-2 border-violet-400 bg-violet-50 h-full transition-shadow group-hover:shadow-md group-active:scale-[0.98]">
                        <CardContent className="p-4 flex flex-col items-center justify-center gap-2 h-full min-h-[100px]">
                            <div className="flex items-center gap-2 self-start">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-white text-xs font-bold shrink-0">3</span>
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
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/40">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('odbior.statusHeader')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('odbior.dateHeader')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('odbior.fromHeader')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('odbior.personsHeader')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('odbior.recruiterHeader')}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('odbior.actionsHeader')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                                                {t('odbior.noSubmissions')}
                                            </td>
                                        </tr>
                                    ) : submissions.map((row, i) => (
                                        <tr key={row.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/30')}>
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                                                    STATUS_STYLES[row.status] ?? 'text-gray-600 bg-gray-50 border border-gray-200'
                                                )}>
                                                    {statusLabel(row.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{row.date}</td>
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
                                                    {(_currentUser.isAdmin || !_currentUser.isDriver) && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                                            aria-label={t('common.delete')}
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
