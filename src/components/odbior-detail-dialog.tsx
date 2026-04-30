'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { OdbiorZgloszenie, OsobaWOdbiorze, SessionData } from '@/types';
import { OdbiorZakwaterowanieDialog } from '@/components/odbior-zakwaterowanie-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    MapPin, Phone, Users, MessageSquare, User, Bed, Stethoscope,
    Pencil, Trash2, Plus, Check, PhoneCall, ImagePlus, X, ScanLine,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SKAD_LABELS: Record<string, string> = {
    autobusowa: 'Stacja autobusowa',
    pociagowa: 'Stacja pociągowa',
    inne: 'Inne',
};

function parseOsoby(raw: string): OsobaWOdbiorze[] {
    try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, isNew }: { status: string; isNew?: boolean }) {
    if (isNew) {
        return (
            <span className="inline-flex items-center rounded-full bg-destructive text-white text-xs font-bold px-3 py-1">
                NOWE
            </span>
        );
    }
    const styles: Record<string, string> = {
        'Nieprzyjęte': 'bg-red-100 text-red-700 border border-red-200',
        'W trakcie':   'bg-amber-100 text-amber-700 border border-amber-200',
        'Zakończone':  'bg-success/20 text-success-foreground border border-green-200',
        'Dostarczone': 'bg-success/20 text-success-foreground border border-green-200',
    };
    return (
        <span className={cn('inline-flex items-center rounded-full text-xs font-semibold px-3 py-1', styles[status] ?? 'bg-gray-100 text-gray-700')}>
            {status}
        </span>
    );
}

// ─── Popover wyboru połączenia ────────────────────────────────────────────────

function PhonePopover({ number }: { number: string }) {
    const digits = number.replace(/\D/g, '');
    const e164 = digits.startsWith('0') ? `+48${digits.slice(1)}` : `+${digits}`;
    const e164encoded = encodeURIComponent(e164);

    const options: { label: string; icon: React.ElementType; action: () => void }[] = [
        {
            label: 'Zadzwoń',
            icon: Phone,
            action: () => { window.location.href = `tel:${number}`; },
        },
        {
            label: 'Zadzwoń na Viber',
            icon: PhoneCall,
            action: () => { window.location.href = `viber://chat?number=${e164encoded}`; },
        },
        {
            label: 'Zadzwoń na WhatsApp',
            icon: PhoneCall,
            action: () => { window.open(`https://wa.me/${digits}`, '_blank'); },
        },
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="underline decoration-dotted text-blue-700 hover:text-blue-900 cursor-pointer font-medium focus:outline-none">
                    {number}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="start">
                {options.map(({ label, icon: Icon, action }) => (
                    <button
                        key={label}
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                        onClick={action}
                    >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        {label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}

// ─── Szczegóły zgłoszenia (wspólna część) ────────────────────────────────────

function ZgloszenieInfo({ z }: { z: OdbiorZgloszenie }) {
    const shortId = z.id.slice(-4).toUpperCase();
    return (
        <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between mb-1">
                <StatusBadge status={z.status} isNew={z.status === 'Nieprzyjęte'} />
                <span className="text-xs text-muted-foreground">Zgłoszenie #{shortId}</span>
            </div>
            <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span><b>Skąd:</b> {SKAD_LABELS[z.skad] ?? z.skad}{z.komentarzSkad ? ` — ${z.komentarzSkad}` : ''}</span></div>
            <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span><b>Telefon:</b>{' '}
                    <PhonePopover number={z.numerTelefonu} />
                </span>
            </div>
            <div className="flex items-start gap-2"><Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span><b>Ilość osób:</b> {z.iloscOsob}</span></div>
            {z.komentarz && <div className="flex items-start gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span><b>Komentarz:</b> {z.komentarz}</span></div>}
            <div className="flex items-start gap-2"><User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span><b>Rekruter:</b> {z.rekruterNazwa}</span></div>
            {z.kierowcaNazwa && <div className="flex items-start gap-2"><User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span><b>Kierowca:</b> {z.kierowcaNazwa}</span></div>}
            <p className="text-xs text-muted-foreground text-right pt-1">{z.dataZgloszenia}</p>
        </div>
    );
}

// ─── Formularz edycji danych zgłoszenia ──────────────────────────────────────

const SKAD_OPTIONS = [
    { value: 'autobusowa', label: 'Stacja autobusowa' },
    { value: 'pociagowa',  label: 'Stacja pociągowa' },
    { value: 'inne',       label: 'Inne' },
] as const;

function EditZgloszenieForm({
    z,
    onSave,
    onCancel,
}: {
    z: OdbiorZgloszenie;
    onSave: (updates: Partial<OdbiorZgloszenie>) => Promise<void>;
    onCancel: () => void;
}) {
    const [fields, setFields] = useState({
        numerTelefonu: z.numerTelefonu,
        skad: z.skad,
        komentarzSkad: z.komentarzSkad,
        iloscOsob: z.iloscOsob,
        komentarz: z.komentarz,
    });
    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [newPreviews, setNewPreviews] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const existingUrls = z.zdjeciaUrls ? z.zdjeciaUrls.split(',').filter(Boolean) : [];

    useEffect(() => {
        const urls = newFiles.map(f => URL.createObjectURL(f));
        setNewPreviews(urls);
        return () => { urls.forEach(u => URL.revokeObjectURL(u)); };
    }, [newFiles]);

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0) setNewFiles(prev => [...prev, ...files]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = async () => {
        if (!fields.numerTelefonu.trim()) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Numer telefonu jest wymagany.' });
            return;
        }
        setSaving(true);
        try {
            let zdjeciaUrls = z.zdjeciaUrls;

            if (newFiles.length > 0) {
                const fd = new FormData();
                newFiles.forEach(f => fd.append('zdjecia', f));
                const res = await fetch(`/api/odbior/zgloszenie/${z.id}/photos`, { method: 'POST', body: fd });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error ?? 'Błąd uploadu zdjęć');
                }
                const data = await res.json();
                zdjeciaUrls = data.zdjeciaUrls;
            }

            await onSave({ ...fields, zdjeciaUrls });
            toast({ title: 'Zapisano zmiany' });
            onCancel();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Błąd', description: e instanceof Error ? e.message : 'Nieznany błąd.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edytuj dane zgłoszenia</p>

            <div>
                <Label className="text-xs">Numer telefonu *</Label>
                <Input className="h-8 text-sm mt-1" value={fields.numerTelefonu}
                    onChange={e => setFields(f => ({ ...f, numerTelefonu: e.target.value }))} />
            </div>

            <div>
                <Label className="text-xs">Skąd</Label>
                <select
                    className="mt-1 w-full h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={fields.skad}
                    onChange={e => setFields(f => ({ ...f, skad: e.target.value as OdbiorZgloszenie['skad'] }))}
                >
                    {SKAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            <div>
                <Label className="text-xs">Szczegóły miejsca</Label>
                <Input className="h-8 text-sm mt-1" value={fields.komentarzSkad}
                    onChange={e => setFields(f => ({ ...f, komentarzSkad: e.target.value }))} />
            </div>

            <div>
                <Label className="text-xs">Ilość osób</Label>
                <div className="flex items-center gap-2 mt-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => setFields(f => ({ ...f, iloscOsob: Math.max(1, f.iloscOsob - 1) }))}>
                        <span className="text-base leading-none">−</span>
                    </Button>
                    <span className="w-8 text-center font-semibold text-sm">{fields.iloscOsob}</span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => setFields(f => ({ ...f, iloscOsob: Math.min(99, f.iloscOsob + 1) }))}>
                        <span className="text-base leading-none">+</span>
                    </Button>
                </div>
            </div>

            <div>
                <Label className="text-xs">Komentarz</Label>
                <Input className="h-8 text-sm mt-1" value={fields.komentarz}
                    onChange={e => setFields(f => ({ ...f, komentarz: e.target.value }))} />
            </div>

            {/* Zdjęcia */}
            <div className="space-y-2">
                <Label className="text-xs">Zdjęcia</Label>

                {/* Istniejące */}
                {existingUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                        {existingUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="block rounded-md overflow-hidden aspect-square bg-muted border">
                                <img src={url} alt="" className="object-cover w-full h-full" />
                            </a>
                        ))}
                    </div>
                )}

                {/* Nowe (lokalne preview) */}
                {newPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                        {newPreviews.map((url, i) => (
                            <div key={i} className="relative rounded-md overflow-hidden aspect-square bg-muted border">
                                <img src={url} alt="" className="object-cover w-full h-full" />
                                <button type="button"
                                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                                    onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}>
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <Button type="button" variant="outline" size="sm" className="w-full gap-1.5"
                    onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Dodaj zdjęcia
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileAdd} />
            </div>

            <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" disabled={saving} onClick={onCancel}>Anuluj</Button>
                <Button size="sm" className="flex-1" disabled={saving} onClick={handleSave}>
                    {saving ? 'Zapisywanie...' : 'Zapisz'}
                </Button>
            </div>
        </div>
    );
}

// ─── Karta — Nieprzyjęte ─────────────────────────────────────────────────────

function KartaNieprzyjete({
    z, onAction, onEdit, canEdit,
}: {
    z: OdbiorZgloszenie;
    onAction: (action: 'przyjmij' | 'odrzuc') => Promise<void>;
    onEdit: (updates: Partial<OdbiorZgloszenie>) => Promise<void>;
    canEdit: boolean;
}) {
    const [loading, setLoading] = useState<'przyjmij' | 'odrzuc' | null>(null);
    const [editing, setEditing] = useState(false);

    const handle = async (a: 'przyjmij' | 'odrzuc') => {
        setLoading(a);
        try { await onAction(a); } finally { setLoading(null); }
    };
    return (
        <div className="space-y-3">
            {editing ? (
                <EditZgloszenieForm z={z} onSave={onEdit} onCancel={() => setEditing(false)} />
            ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-4">
                    <ZgloszenieInfo z={z} />
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={!!loading}
                            onClick={() => setEditing(true)}
                        >
                            Edytuj dane
                        </Button>
                    )}
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" disabled={!!loading} onClick={() => handle('odrzuc')}>
                            Odrzuć
                        </Button>
                        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={!!loading} onClick={() => handle('przyjmij')}>
                            {loading === 'przyjmij' ? 'Przyjmowanie...' : 'Przyjmij'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Edycja osoby (inline) ───────────────────────────────────────────────────

function EditPersonRow({ person, onSave, onCancel }: {
    person: OsobaWOdbiorze;
    onSave: (p: OsobaWOdbiorze) => void;
    onCancel: () => void;
}) {
    const [p, setP] = useState(person);
    return (
        <div className="rounded-lg border bg-white p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Imię</Label><Input className="h-8 text-sm" value={p.imie} onChange={e => setP(x => ({ ...x, imie: e.target.value }))} /></div>
                <div><Label className="text-xs">Nazwisko</Label><Input className="h-8 text-sm" value={p.nazwisko} onChange={e => setP(x => ({ ...x, nazwisko: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Paszport</Label><Input className="h-8 text-sm" value={p.paszport} onChange={e => setP(x => ({ ...x, paszport: e.target.value }))} /></div>
            <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>Anuluj</Button>
                <Button size="sm" className="flex-1" onClick={() => onSave(p)}>Zapisz</Button>
            </div>
        </div>
    );
}

// ─── Karta — W trakcie ───────────────────────────────────────────────────────

function KartaWTrakcie({
    z, onAction, onZakwaterowanieClick,
}: {
    z: OdbiorZgloszenie;
    onAction: (action: 'odrzuc' | 'zakoncz' | 'update', payload: Partial<OdbiorZgloszenie>) => Promise<void>;
    onZakwaterowanieClick?: (osoba: OsobaWOdbiorze | null) => void;
}) {
    const osoby = parseOsoby(z.osoby);
    const [localOsoby, setLocalOsoby] = useState<OsobaWOdbiorze[]>(osoby);
    const [newPerson, setNewPerson] = useState<OsobaWOdbiorze>({ imie: '', nazwisko: '', paszport: '' });
    const [editIdx, setEditIdx] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const ocrInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const saveOsoby = async (updated: OsobaWOdbiorze[]) => {
        setLocalOsoby(updated);
        await onAction('update', { osoby: JSON.stringify(updated) });
    };

    const handleAddPerson = async () => {
        if (!newPerson.imie.trim() || !newPerson.nazwisko.trim()) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Imię i nazwisko są wymagane.' });
            return;
        }
        const updated = [...localOsoby, newPerson];
        await saveOsoby(updated);
        toast({ title: 'Dodano osobę', description: `${newPerson.imie} ${newPerson.nazwisko}` });
        setNewPerson({ imie: '', nazwisko: '', paszport: '' });
    };

    const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (ocrInputRef.current) ocrInputRef.current.value = '';
        setOcrLoading(true);
        try {
            const fd = new FormData();
            fd.append('photo', file);
            const res = await fetch('/api/odbior/ocr', { method: 'POST', body: fd });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Błąd OCR');
            const data = await res.json();
            setNewPerson(p => ({
                imie:     data.imie     || p.imie,
                nazwisko: data.nazwisko || p.nazwisko,
                paszport: data.paszport || p.paszport,
            }));
            toast({ title: 'Dane odczytane', description: `${data.imie} ${data.nazwisko} — ${data.paszport}` });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Błąd OCR', description: err instanceof Error ? err.message : 'Nie udało się odczytać dokumentu.' });
        } finally {
            setOcrLoading(false);
        }
    };

    const handleRemovePerson = async (idx: number) => {
        await saveOsoby(localOsoby.filter((_, i) => i !== idx));
    };

    const handleEditSave = async (idx: number, updated: OsobaWOdbiorze) => {
        const arr = localOsoby.map((o, i) => i === idx ? updated : o);
        await saveOsoby(arr);
        setEditIdx(null);
    };

    const handleKrok = async (krok: string) => {
        const newKrok = activeKrok === krok ? '' : krok;
        await onAction('update', { nastepnyKrok: newKrok });
        if (newKrok) {
            toast({ title: 'Zapisano', description: `Następny krok: ${newKrok}` });
        }
    };

    const handleOdrzuc = async () => {
        setLoading(true);
        try { await onAction('odrzuc', {}); } finally { setLoading(false); }
    };

    const handleZakoncz = async () => {
        setLoading(true);
        try { await onAction('zakoncz', {}); } finally { setLoading(false); }
    };

    const activeKrok = z.nastepnyKrok;

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
            <ZgloszenieInfo z={z} />

            {/* Lista osób */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Lista osób ({localOsoby.length}/{z.iloscOsob})
                </p>
                {localOsoby.map((o, i) => (
                    <div key={i}>
                        {editIdx === i ? (
                            <EditPersonRow
                                person={o}
                                onSave={upd => handleEditSave(i, upd)}
                                onCancel={() => setEditIdx(null)}
                            />
                        ) : (
                            <div className="flex items-center justify-between rounded-lg bg-white border px-3 py-2 text-sm">
                                <div>
                                    <span className="font-medium">{i + 1}. {o.imie} {o.nazwisko}</span>
                                    {o.paszport && <span className="text-muted-foreground ml-2 text-xs">Paszport: {o.paszport}</span>}
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Zakwateruj" onClick={() => onZakwaterowanieClick?.(o)}>
                                        <Bed className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditIdx(i)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemovePerson(i)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Formularz dodawania osoby — zawsze widoczny */}
                <div className="rounded-lg border bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">Dodaj osobę</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs text-violet-700 border-violet-300 hover:bg-violet-50"
                            disabled={ocrLoading}
                            onClick={() => ocrInputRef.current?.click()}
                        >
                            <ScanLine className="h-3.5 w-3.5" />
                            {ocrLoading ? 'Skanowanie...' : 'Skanuj paszport'}
                        </Button>
                        <input ref={ocrInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleOcr} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Imię *</Label><Input className="h-8 text-sm" value={newPerson.imie} onChange={e => setNewPerson(p => ({ ...p, imie: e.target.value }))} /></div>
                        <div><Label className="text-xs">Nazwisko *</Label><Input className="h-8 text-sm" value={newPerson.nazwisko} onChange={e => setNewPerson(p => ({ ...p, nazwisko: e.target.value }))} /></div>
                    </div>
                    <div><Label className="text-xs">Numer paszportu</Label><Input className="h-8 text-sm" value={newPerson.paszport} onChange={e => setNewPerson(p => ({ ...p, paszport: e.target.value }))} /></div>
                    <Button size="sm" className="w-full gap-1" onClick={handleAddPerson}>
                        <Plus className="h-3.5 w-3.5" /> Dodaj osobę
                    </Button>
                </div>
            </div>

            {/* Następny krok */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wybierz następny krok</p>
                <div className="flex gap-2 flex-wrap">
                    {[
                        { value: 'zakwaterowanie', label: 'Zakwaterowanie', icon: Bed },
                        { value: 'badania', label: 'Badania', icon: Stethoscope },
                        { value: 'rozmowa', label: 'Rozmowa rekrutacyjna', icon: Users },
                    ].map(({ value, label, icon: Icon }) => (
                        <Button
                            key={value}
                            variant={activeKrok === value ? 'default' : 'outline'}
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => {
                                const isDeselect = activeKrok === value;
                                handleKrok(value);
                                if (value === 'zakwaterowanie' && !isDeselect) {
                                    onZakwaterowanieClick?.(localOsoby[0] ?? null);
                                }
                            }}
                        >
                            <Icon className="h-3.5 w-3.5" /> {label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex gap-3">
                <Button
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                    onClick={handleOdrzuc}
                >
                    Odrzuć
                </Button>
                <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                    disabled={loading}
                    onClick={handleZakoncz}
                >
                    <Check className="h-4 w-4" />
                    {loading ? 'Kończenie...' : 'Zakończ odbiór'}
                </Button>
            </div>
        </div>
    );
}

// ─── Karta — Zakończone ──────────────────────────────────────────────────────

function KartaZakonczona({ z }: { z: OdbiorZgloszenie }) {
    const osoby = parseOsoby(z.osoby);
    return (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
            <ZgloszenieInfo z={z} />
            {osoby.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lista osób</p>
                    {osoby.map((o, i) => (
                        <div key={i} className="flex items-center rounded-lg bg-white border px-3 py-2 text-sm gap-2">
                            <span className="font-medium">{i + 1}. {o.imie} {o.nazwisko}</span>
                            {o.paszport && <span className="text-muted-foreground text-xs">Paszport: {o.paszport}</span>}
                        </div>
                    ))}
                </div>
            )}
            {z.dataZakonczenia && (
                <p className="text-xs text-muted-foreground text-right">Zakończono: {z.dataZakonczenia}</p>
            )}
        </div>
    );
}

// ─── Główny dialog ───────────────────────────────────────────────────────────

interface OdbiorDetailDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    zgloszenie: OdbiorZgloszenie;
    allZgloszenia: OdbiorZgloszenie[];
    currentUser: SessionData;
    onStatusChange: (id: string, updates: Partial<OdbiorZgloszenie>) => void;
}

export default function OdbiorDetailDialog({
    open, onOpenChange, zgloszenie, allZgloszenia, currentUser, onStatusChange,
}: OdbiorDetailDialogProps) {
    const { toast } = useToast();
    const [localZ, setLocalZ] = useState(zgloszenie);
    const [zakwatOpen, setZakwatOpen] = useState(false);
    const [zakwatPrefill, setZakwatPrefill] = useState<{ firstName?: string; lastName?: string; passportNumber?: string } | undefined>();

    React.useEffect(() => { setLocalZ(zgloszenie); }, [zgloszenie]);

    const handleZakwaterowanieClick = (osoba: OsobaWOdbiorze | null) => {
        setZakwatPrefill(osoba ? {
            firstName: osoba.imie,
            lastName: osoba.nazwisko,
            passportNumber: osoba.paszport,
        } : undefined);
        setZakwatOpen(true);
    };

    const counts = {
        'Nieprzyjęte': allZgloszenia.filter(z => z.status === 'Nieprzyjęte').length,
        'W trakcie':   allZgloszenia.filter(z => z.status === 'W trakcie').length,
        'Zakończone':  allZgloszenia.filter(z => z.status === 'Zakończone' || z.status === 'Dostarczone').length,
    };

    const tabValue = localZ.status === 'Dostarczone' ? 'Zakończone' : localZ.status;

    const patch = (updates: Partial<OdbiorZgloszenie>) => {
        setLocalZ(prev => ({ ...prev, ...updates }));
        onStatusChange(localZ.id, updates);
    };

    const callApi = async (action: string, payload?: object) => {
        const res = await fetch(`/api/odbior/zgloszenie/${localZ.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? 'Błąd serwera');
        }
    };

    const handleEditDane = async (updates: Partial<OdbiorZgloszenie>) => {
        await callApi('update', {
            numerTelefonu: updates.numerTelefonu,
            skad: updates.skad,
            komentarzSkad: updates.komentarzSkad,
            iloscOsob: updates.iloscOsob !== undefined ? String(updates.iloscOsob) : undefined,
            komentarz: updates.komentarz,
            zdjeciaUrls: updates.zdjeciaUrls,
        });
        patch(updates);
    };

    const handleNieprzyjeteAction = async (action: 'przyjmij' | 'odrzuc') => {
        if (action === 'odrzuc') {
            onOpenChange(false);
            return;
        }
        try {
            await callApi('przyjmij');
            patch({ status: 'W trakcie' });
            toast({ title: 'Przyjęto zgłoszenie', description: 'Status zmieniony na "W trakcie".' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Błąd', description: e instanceof Error ? e.message : 'Nieznany błąd.' });
        }
    };

    const handleWTrakcieAction = async (action: 'odrzuc' | 'zakoncz' | 'update', payload: Partial<OdbiorZgloszenie>) => {
        try {
            await callApi(action, action === 'update'
                ? { nastepnyKrok: payload.nastepnyKrok, osoby: payload.osoby }
                : {}
            );
            if (action === 'odrzuc') {
                patch({ status: 'Nieprzyjęte', kierowcaId: '', kierowcaNazwa: '' });
                toast({ title: 'Odrzucono', description: 'Status zmieniony na "Nieprzyjęte".' });
            } else if (action === 'zakoncz') {
                const now = new Date().toLocaleString('pl-PL').replace(',', '').slice(0, 16);
                patch({ status: 'Zakończone', dataZakonczenia: now, ...payload });
                toast({ title: 'Odbiór zakończony', description: 'Status zmieniony na "Zakończone".' });
            } else {
                patch(payload);
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Błąd', description: e instanceof Error ? e.message : 'Nieznany błąd.' });
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Odbiór</DialogTitle>
                    <DialogDescription className="sr-only">
                        Szczegóły i akcje zgłoszenia odbioru
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tabValue}>
                    <TabsList className="w-full">
                        {(['Nieprzyjęte', 'W trakcie', 'Zakończone'] as const).map(tab => (
                            <TabsTrigger key={tab} value={tab} className="flex-1 gap-1.5">
                                {tab}
                                <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted text-xs font-medium px-1.5">
                                    {counts[tab]}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="Nieprzyjęte" className="mt-4">
                        <KartaNieprzyjete
                            z={localZ}
                            onAction={handleNieprzyjeteAction}
                            onEdit={handleEditDane}
                            canEdit={!currentUser.isDriver}
                        />
                    </TabsContent>

                    <TabsContent value="W trakcie" className="mt-4">
                        <KartaWTrakcie z={localZ} onAction={handleWTrakcieAction} onZakwaterowanieClick={handleZakwaterowanieClick} />
                    </TabsContent>

                    <TabsContent value="Zakończone" className="mt-4">
                        <KartaZakonczona z={localZ} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>

        <OdbiorZakwaterowanieDialog
            isOpen={zakwatOpen}
            onOpenChange={setZakwatOpen}
            currentUser={currentUser}
            prefillData={zakwatPrefill}
        />
        </>
    );
}
