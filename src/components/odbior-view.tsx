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

const INITIAL_STATS = { dostarczone: 0, wTrakcie: 0 };
const INITIAL_SUBMISSIONS: { id: string; status: string; date: string; from: string; persons: number; recruiter: string }[] = [];

const STATUS_STYLES: Record<string, string> = {
    'Dostarczone': 'text-success bg-green-50 border border-green-200',
    'W trakcie':   'text-amber-600 bg-amber-50 border border-amber-200',
    'Nieprzyjęte': 'text-destructive bg-red-50 border border-red-200',
    'Zakończone':  'text-success bg-green-50 border border-green-200',
};

const formSchema = z.object({
    phone:       z.string().min(1, 'Numer telefonu jest wymagany.'),
    from:        z.enum(['autobusowa', 'pociagowa', 'inne'], { required_error: 'Wybierz miejsce odbioru.' }),
    fromComment: z.string().optional(),
    persons:     z.number().min(1, 'Minimalna liczba osób to 1.').max(99),
    comment:     z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.from === 'inne' && !data.fromComment?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Podaj szczegóły miejsca przy wyborze "Inne".',
            path: ['fromComment'],
        });
    }
});

type FormValues = z.infer<typeof formSchema>;

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
    const [loading, setLoading] = useState(false);
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            if (!res.ok) throw new Error(data.error ?? 'Błąd serwera');

            toast({ title: 'Zgłoszono odbiór', description: 'Zgłoszenie zostało zapisane.' });
            onSuccess(data.zgloszenie);
            onOpenChange(false);
            form.reset();
            setPhotoFiles([]);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Błąd', description: e instanceof Error ? e.message : 'Nieznany błąd.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Zgłoś odbiór</DialogTitle>
                    <DialogDescription className="sr-only">Formularz zgłoszenia odbioru</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Telefon */}
                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Numer telefonu *</FormLabel>
                                <FormControl><Input placeholder="+48 000 000 000" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* Skąd */}
                        <FormField control={form.control} name="from" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Miejsce odbioru *</FormLabel>
                                <FormControl>
                                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                                        <div className="flex items-center gap-2"><RadioGroupItem value="autobusowa" id="auto" /><Label htmlFor="auto">Stacja autobusowa</Label></div>
                                        <div className="flex items-center gap-2"><RadioGroupItem value="pociagowa" id="poci" /><Label htmlFor="poci">Stacja pociągowa</Label></div>
                                        <div className="flex items-center gap-2"><RadioGroupItem value="inne" id="inne" /><Label htmlFor="inne">Inne</Label></div>
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
                                        Szczegóły miejsca{isInne && <span className="text-destructive ml-1">*</span>}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="np. adres, nazwa stacji..."
                                            {...field}
                                            className={highlight ? 'border-amber-400 bg-amber-50 focus-visible:ring-amber-400' : ''}
                                        />
                                    </FormControl>
                                    {highlight && (
                                        <p className="text-xs text-amber-600 font-medium">
                                            Wypełnij pole Szczegóły miejsca
                                        </p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            );
                        }} />

                        {/* Ilość osób */}
                        <FormField control={form.control} name="persons" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ilość osób *</FormLabel>
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
                                <FormLabel>Komentarz</FormLabel>
                                <FormControl><Textarea placeholder="Dodatkowe informacje..." rows={2} {...field} /></FormControl>
                            </FormItem>
                        )} />

                        {/* Zdjęcia */}
                        <div className="space-y-2">
                            <Label>Zdjęcia</Label>
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
                                <ImagePlus className="h-4 w-4" /> Dodaj zdjęcia
                            </Button>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? 'Wysyłanie...' : 'Zgłoś odbiór'}
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
                from: { autobusowa: 'Stacja autobusowa', pociagowa: 'Stacja pociągowa', inne: 'Inne' }[z.skad] ?? z.skad,
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
    }, []);

    useEffect(() => { loadZgloszenia(); }, [loadZgloszenia]);

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
            from: { autobusowa: 'Stacja autobusowa', pociagowa: 'Stacja pociągowa', inne: 'Inne' }[z.skad] ?? z.skad,
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
                throw new Error(err.error ?? 'Błąd serwera');
            }
            const remaining = allZgloszenia.filter(z => z.id !== deleteConfirmId);
            setAllZgloszenia(remaining);
            setSubmissions(prev => prev.filter(s => s.id !== deleteConfirmId));
            setStats({
                dostarczone: remaining.filter(z => z.status === 'Zakończone' || z.status === 'Dostarczone').length,
                wTrakcie: remaining.filter(z => z.status === 'W trakcie').length,
            });
            toast({ title: 'Usunięto zgłoszenie' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Błąd', description: e instanceof Error ? e.message : 'Nieznany błąd.' });
        } finally {
            setDeleteLoading(false);
            setDeleteConfirmId(null);
        }
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Nagłówek */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Odbiór</h1>
            </div>

            {/* Bloki statystyk */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Dostarczone */}
                <Card className="border-2 border-green-300 bg-green-50">
                    <CardContent className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-white text-xs font-bold shrink-0">1</span>
                            <span className="text-sm font-semibold text-green-800">Dostarczone</span>
                        </div>
                        <p className="text-3xl font-bold text-green-900 pl-8">{stats.dostarczone}</p>
                        <p className="text-xs text-success-foreground pl-8">Wszystkie zakończone</p>
                    </CardContent>
                </Card>

                {/* W trakcie */}
                <Card className="border-2 border-amber-300 bg-amber-50">
                    <CardContent className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white text-xs font-bold shrink-0">2</span>
                            <span className="text-sm font-semibold text-amber-800">W trakcie / nie dostarczone</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-900 pl-8">{stats.wTrakcie}</p>
                        <p className="text-xs text-amber-700 pl-8">Oczekujące na realizację</p>
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
                                <span className="text-sm font-semibold text-violet-800">Nowe zgłoszenie</span>
                            </div>
                            <FileText className="h-8 w-8 text-violet-400 mt-1" />
                            <span className="text-sm font-bold text-violet-700">Zgłoś odbiór</span>
                        </CardContent>
                    </Card>
                </button>
            </div>

            {/* Tabela zgłoszeń */}
            <div className="space-y-3">
                <h2 className="text-base font-semibold">Ostatnie zgłoszenia</h2>
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/40">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data zgłoszenia</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Skąd</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ilość osób</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rekruter</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Akcje</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                                                Brak zgłoszeń
                                            </td>
                                        </tr>
                                    ) : submissions.map((row, i) => (
                                        <tr key={row.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/30')}>
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                                                    STATUS_STYLES[row.status] ?? 'text-gray-600 bg-gray-50 border border-gray-200'
                                                )}>
                                                    {row.status}
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
                                                        onClick={() => handleEyeClick(row.id)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {(_currentUser.isAdmin || !_currentUser.isDriver) && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
                        <DialogTitle>Usuń zgłoszenie</DialogTitle>
                        <DialogDescription>
                            Czy na pewno chcesz trwale usunąć to zgłoszenie? Tej operacji nie można cofnąć.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" disabled={deleteLoading} onClick={() => setDeleteConfirmId(null)}>
                            Anuluj
                        </Button>
                        <Button variant="destructive" disabled={deleteLoading} onClick={handleDelete}>
                            {deleteLoading ? 'Usuwanie...' : 'Usuń'}
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
