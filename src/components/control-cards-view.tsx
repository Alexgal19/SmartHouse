
"use client";

import React, { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardCheck, Search, CheckCircle2,
    AlertCircle, Clock, ChevronRight, Building2,
    ShieldCheck, Wrench, ChevronDown, Bed,
    Camera, ImageIcon, X, Download, Loader2,
    Lock, KeyRound
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import type { SessionData, Address, ControlCard, CleanlinessRating, RoomRating } from "@/types";
import { useMainLayout } from '@/components/main-layout';
import { saveControlCardAction, editControlCardAction, uploadControlCardPhotoAction } from '@/lib/actions';
import { format } from 'date-fns';

// ─── PIN Lock Component ──────────────────────────────────────────────────

function PINLock({ onUnlock }: { onUnlock: () => void }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === '2991') {
            onUnlock();
        } else {
            setError(true);
            setPin('');
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Moduł Zablokowany</h2>
            <p className="text-muted-foreground mb-8 max-w-sm">
                Ta sekcja jest tymczasowo zablokowana. Wprowadź kod dostępu, aby kontynuować.
            </p>
            <form onSubmit={handleSubmit} className="w-full max-w-[280px] space-y-4">
                <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="password"
                        placeholder="Wprowadź kod PIN"
                        className={`pl-9 text-center tracking-[0.5em] font-mono text-lg ${error ? 'border-destructive ring-destructive shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        autoFocus
                    />
                </div>
                <Button type="submit" className="w-full shadow-lg shadow-primary/20">
                    Odblokuj Dostęp
                </Button>
                {error && (
                    <p className="text-xs text-red-500 font-medium animate-in slide-in-from-top-1">
                        Nieprawidłowy kod PIN. Spróbuj ponownie.
                    </p>
                )}
            </form>
        </div>
    );
}

// ─── Photo Upload Widget (reusable) ──────────────────────────────────────────

function PhotoUploadWidget({
    label, photoUrls, isUploading, canEdit, onAddPhotos, onRemove, onLightbox
}: {
    label: string;
    photoUrls: string[];
    isUploading: boolean;
    canEdit: boolean;
    onAddPhotos: (e: React.ChangeEvent<HTMLInputElement>, capture?: boolean) => void;
    onRemove: (idx: number) => void;
    onLightbox: (url: string) => void;
}) {
    const cameraRef = React.useRef<HTMLInputElement>(null);
    const galleryRef = React.useRef<HTMLInputElement>(null);
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">{label}</Label>
                {canEdit && (
                    <div className="flex gap-1">
                        {/* Aparat */}
                        <div className="relative">
                            <input
                                ref={cameraRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => onAddPhotos(e, true)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            <Button type="button" size="sm" variant="secondary" className="h-7 text-[10px] gap-1 pointer-events-none" disabled={isUploading}>
                                {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                                Aparat
                            </Button>
                        </div>
                        {/* Galeria */}
                        <div className="relative">
                            <input
                                ref={galleryRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => onAddPhotos(e, false)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] gap-1 pointer-events-none" disabled={isUploading}>
                                <ImageIcon className="w-3 h-3" />
                                Galeria
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            {(photoUrls.length > 0 || isUploading) ? (
                <div className="border border-border/40 rounded-lg p-2 bg-background flex gap-2 flex-wrap items-center">
                    {photoUrls.map((url, idx) => (
                        <div key={idx} className="relative group rounded-md border border-border/50 overflow-hidden w-16 h-16 bg-muted">
                            <img
                                src={url}
                                alt={`Zdjęcie ${idx + 1}`}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => onLightbox(url)}
                                loading="lazy"
                            />
                            {canEdit && (
                                <button
                                    type="button"
                                    title="Usuń zdjęcie"
                                    onClick={() => onRemove(idx)}
                                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    {isUploading && (
                        <div className="w-16 h-16 bg-muted/50 rounded-md border flex items-center justify-center border-dashed">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    )}
                </div>
            ) : (
                <div className="border border-dashed border-border/60 rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground gap-1">
                    <ImageIcon className="w-5 h-5 opacity-40" />
                    <span className="text-[10px]">Brak wgranych zdjęć</span>
                </div>
            )}
        </div>
    );
}

// ─── Lightbox Component ─────────────────────────────────────────────────────

function Lightbox({ image, onClose }: { image: string | null; onClose: () => void }) {
    if (!image) return null;

    return (
        <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-transparent border-none shadow-none ring-0 focus:ring-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Podgląd zdjęcia</DialogTitle>
                    <DialogDescription>Powiększony widok wybranego zdjęcia.</DialogDescription>
                </DialogHeader>
                <div className="relative flex flex-col items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                    <motion.img
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        src={image}
                        alt="Podgląd"
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl overflow-hidden cursor-default pointer-events-auto"
                    />
                    <div className="absolute top-6 right-6 flex gap-3 pointer-events-auto">
                        <Button 
                            size="icon" 
                            variant="secondary" 
                            className="rounded-full shadow-xl h-10 w-10 bg-white/90 hover:bg-white text-black" 
                            asChild
                        >
                            <a href={image} target="_blank" rel="noopener noreferrer">
                                <Download className="w-5 h-5" />
                            </a>
                        </Button>
                        <Button 
                            size="icon" 
                            variant="destructive" 
                            className="rounded-full shadow-xl h-10 w-10" 
                            onClick={onClose}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── helpers ────────────────────────────────────────────────────────────────

const isPrivateAddress = (name: string): boolean => {
    const n = name.toLowerCase().replace(/ł/g, 'l').replace(/ą/g, 'a').replace(/ę/g, 'e');
    return n.startsWith('wlasne mieszkan');
};

const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        options.push({ value: format(d, 'yyyy-MM'), label: format(d, 'LLLL yyyy').replace(/^\w/, c => c.toUpperCase()) });
    }
    return options;
};

const ratingBadge = (r: CleanlinessRating) => {
    let colorClass = "bg-muted text-muted-foreground border-muted-foreground/20";
    if (r >= 8) colorClass = "bg-green-500/10 text-green-600 border-green-500/20";
    else if (r >= 4) colorClass = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    else if (r > 0) colorClass = "bg-red-500/10 text-red-600 border-red-500/20";

    return <Badge className={`${colorClass} text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full p-0`}>{r}</Badge>;
};

const calculateAverage = (card: ControlCard): number => {
    const ratings = [
        ...card.roomRatings.map(r => r.rating),
        card.cleanKitchen,
        card.cleanBathroom
    ];
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
};

const RatingField = ({
    label, field, value, onChange, disabled,
}: {
    label: string;
    field: string;
    value: CleanlinessRating;
    onChange: (v: CleanlinessRating) => void;
    disabled?: boolean;
}) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">{label}</Label>
            <span className={`text-sm font-bold ${value >= 8 ? 'text-green-500' : value >= 4 ? 'text-yellow-600' : 'text-red-500'}`}>
                {value}/10
            </span>
        </div>
        <div className="flex gap-1 justify-between">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                    key={n}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(n)}
                    className={`w-7 h-7 rounded-md text-[10px] font-bold border transition-all flex items-center justify-center
                        ${value === n 
                            ? 'bg-primary text-primary-foreground border-primary scale-110 shadow-sm' 
                            : 'bg-background hover:bg-muted text-muted-foreground border-border hover:border-primary/50'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    {n}
                </button>
            ))}
        </div>
    </div>
);

// ─── Form State ────────────────────────────────────────────────────────────

type FormState = {
    roomRatings: RoomRating[];
    cleanKitchen: CleanlinessRating;
    cleanBathroom: CleanlinessRating;
    kitchenPhotoUrls: string[];
    bathroomPhotoUrls: string[];
    appliancesWorking: boolean;
    comments: string;
};

const buildDefaultForm = (address: Address): FormState => ({
    roomRatings: address.rooms.map(r => ({ roomId: r.id, roomName: r.name, rating: 10, comment: '', photoUrls: [] })),
    cleanKitchen: 10,
    cleanBathroom: 10,
    kitchenPhotoUrls: [],
    bathroomPhotoUrls: [],
    appliancesWorking: true,
    comments: '',
});

const buildFormFromCard = (card: ControlCard, address: Address): FormState => {
    // Merge saved room ratings with current rooms (in case rooms changed)
    const savedMap = new Map(card.roomRatings.map(r => [r.roomId, r]));
    const roomRatings = address.rooms.map(r => {
        const saved = savedMap.get(r.id);
        return {
            roomId: r.id,
            roomName: r.name,
            rating: saved?.rating ?? 10,
            comment: saved?.comment ?? '',
            photoUrls: saved?.photoUrls || [],
        };
    });
    return {
        roomRatings,
        cleanKitchen: card.cleanKitchen,
        cleanBathroom: card.cleanBathroom,
        kitchenPhotoUrls: (card as any).kitchenPhotoUrls || [],
        bathroomPhotoUrls: (card as any).bathroomPhotoUrls || [],
        appliancesWorking: card.appliancesWorking,
        comments: card.comments,
    };
};

// ─── Form Dialog ─────────────────────────────────────────────────────────────

function ControlCardDialog({
    open, onClose, address, existingCard, currentUser, selectedMonth, onSaved,
}: {
    open: boolean;
    onClose: () => void;
    address: Address;
    existingCard: ControlCard | null;
    currentUser: SessionData;
    selectedMonth: string;
    onSaved: (card: ControlCard) => void;
}) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [form, setForm] = useState<FormState>(() =>
        existingCard ? buildFormFromCard(existingCard, address) : buildDefaultForm(address)
    );

    React.useEffect(() => {
        if (open) {
            setForm(existingCard ? buildFormFromCard(existingCard, address) : buildDefaultForm(address));
        }
    }, [open, existingCard, address]);

    const isCurrentMonth = selectedMonth === format(new Date(), 'yyyy-MM');
    const canEdit = !existingCard || isCurrentMonth;

    const setRoomRating = (roomId: string, rating: CleanlinessRating) => {
        setForm(prev => ({
            ...prev,
            roomRatings: prev.roomRatings.map(r => r.roomId === roomId ? { ...r, rating } : r),
        }));
    };

    const setRoomComment = (roomId: string, comment: string) => {
        setForm(prev => ({
            ...prev,
            roomRatings: prev.roomRatings.map(r => r.roomId === roomId ? { ...r, comment } : r),
        }));
    };

    const [uploadingRooms, setUploadingRooms] = useState<Record<string, boolean>>({});
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new window.Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); 
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    // Generic photo upload handler
    const uploadPhotos = async (files: FileList, key: 'kitchen' | 'bathroom' | string): Promise<string[]> => {
        const newPhotos: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            const base64 = await compressImage(file);
            const res = await uploadControlCardPhotoAction(base64, file.name || 'photo.jpg', 'image/jpeg');
            if (res.error) {
                toast({ title: 'Błąd wgrywania', description: res.error, variant: 'destructive' });
            } else if (res.url) {
                newPhotos.push(res.url);
            }
        }
        return newPhotos;
    };

    const handleAddPhotos = async (roomId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setUploadingRooms(prev => ({ ...prev, [roomId]: true }));
        try {
            const newPhotos = await uploadPhotos(e.target.files, roomId);
            if (newPhotos.length > 0) {
                setForm(prev => ({
                    ...prev,
                    roomRatings: prev.roomRatings.map(r =>
                        r.roomId === roomId ? { ...r, photoUrls: [...(r.photoUrls || []), ...newPhotos] } : r
                    )
                }));
                toast({ title: 'Zdjęcia dodane ✅', description: `Wgrano ${newPhotos.length} zdjęć.` });
            }
        } catch (err: any) {
            toast({ title: 'Błąd wgrywania', description: err.message, variant: 'destructive' });
        } finally {
            setUploadingRooms(prev => ({ ...prev, [roomId]: false }));
            e.target.value = '';
        }
    };

    const handleRemovePhoto = (roomId: string, indexToRemove: number) => {
        setForm(prev => ({
            ...prev,
            roomRatings: prev.roomRatings.map(r =>
                r.roomId === roomId ? { ...r, photoUrls: (r.photoUrls || []).filter((_, idx) => idx !== indexToRemove) } : r
            )
        }));
    };

    const [isUploadingKitchen, setIsUploadingKitchen] = useState(false);
    const [isUploadingBathroom, setIsUploadingBathroom] = useState(false);

    const handleAddCommonPhotos = async (
        section: 'kitchen' | 'bathroom',
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!e.target.files?.length) return;
        const setState = section === 'kitchen' ? setIsUploadingKitchen : setIsUploadingBathroom;
        setState(true);
        try {
            const newPhotos = await uploadPhotos(e.target.files, section);
            if (newPhotos.length > 0) {
                const field = section === 'kitchen' ? 'kitchenPhotoUrls' : 'bathroomPhotoUrls';
                setForm(prev => ({ ...prev, [field]: [...(prev[field] || []), ...newPhotos] }));
                toast({ title: 'Zdjęcia dodane ✅', description: `Wgrano ${newPhotos.length} zdjęć.` });
            }
        } catch (err: any) {
            toast({ title: 'Błąd wgrywania', description: err.message, variant: 'destructive' });
        } finally {
            setState(false);
            e.target.value = '';
        }
    };

    const handleRemoveCommonPhoto = (section: 'kitchen' | 'bathroom', idx: number) => {
        const field = section === 'kitchen' ? 'kitchenPhotoUrls' : 'bathroomPhotoUrls';
        setForm(prev => ({ ...prev, [field]: (prev[field] || []).filter((_, i) => i !== idx) }));
    };

    const [openRoomId, setOpenRoomId] = useState<string | null>(null);

    const toggleRoom = (roomId: string) => {
        setOpenRoomId(prev => prev === roomId ? null : roomId);
    };

    const handleSave = () => {
        startTransition(async () => {
            if (existingCard) {
                const result = await editControlCardAction(existingCard.id, form);
                if (result.success) {
                    toast({ title: 'Zaktualizowano ✅', description: `Karta dla "${address.name}" zapisana.` });
                    onSaved({ ...existingCard, ...form, fillDate: new Date().toISOString().slice(0, 10) });
                    onClose();
                } else {
                    toast({ title: 'Błąd', description: result.error, variant: 'destructive' });
                }
            } else {
                const cardData: Omit<ControlCard, 'id'> = {
                    addressId: address.id,
                    addressName: address.name,
                    coordinatorId: currentUser.uid,
                    coordinatorName: currentUser.name,
                    controlMonth: selectedMonth,
                    fillDate: new Date().toISOString().slice(0, 10),
                    ...form,
                };
                const result = await saveControlCardAction(cardData);
                if (result.success && result.id) {
                    toast({ title: 'Karta zapisana! ✅', description: `Kontrola "${address.name}" zakończona.` });
                    onSaved({ id: result.id, ...cardData });
                    onClose();
                } else {
                    toast({ title: 'Błąd zapisu', description: result.error, variant: 'destructive' });
                }
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <ClipboardCheck className="w-4 h-4 text-primary shrink-0" />
                        Karta kontroli: {address.name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Szczegóły widoku karty kontroli czystości mieszkania.
                    </DialogDescription>
                    <p className="text-xs text-muted-foreground">
                        Miesiąc: <span className="font-medium text-foreground">{selectedMonth}</span>
                        {' · '}{address.locality}
                    </p>
                </DialogHeader>

                {!canEdit && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Edycja możliwa tylko w bieżącym miesiącu. Raport zarchiwizowany.
                    </div>
                )}

                <div className="space-y-5">
                    {/* ── Pokoje per-room ── */}
                    {form.roomRatings.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Bed className="w-4 h-4 text-primary" />
                                <h3 className="font-semibold text-sm">Kontrola pokoi</h3>
                            </div>
                            <div className="space-y-2 pl-1">
                                {form.roomRatings.map(rr => (
                                    <div key={rr.roomId} className="rounded-lg border bg-muted/20 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => toggleRoom(rr.roomId)}
                                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                                    Pokój {rr.roomName}
                                                </p>
                                                {ratingBadge(rr.rating)}
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${openRoomId === rr.roomId ? 'rotate-180' : ''}`} />
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {openRoomId === rr.roomId && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <div className="p-3 pt-0 space-y-3 border-t border-border/40">
                                                        <RatingField
                                                            label="Ocena czystości"
                                                            field={`room-${rr.roomId}`}
                                                            value={rr.rating}
                                                            onChange={(v) => setRoomRating(rr.roomId, v)}
                                                            disabled={!canEdit}
                                                        />
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-medium">Komentarz do pokoju</Label>
                                                            <Textarea
                                                                disabled={!canEdit}
                                                                placeholder="Dodaj komentarz do pokoju..."
                                                                value={rr.comment || ''}
                                                                onChange={(e) => setRoomComment(rr.roomId, e.target.value)}
                                                                className="min-h-[60px] text-xs resize-none"
                                                            />
                                                        </div>
                                                        {canEdit && (
                                                            <PhotoUploadWidget
                                                                label="Zdjęcia z pokoju"
                                                                photoUrls={rr.photoUrls || []}
                                                                isUploading={!!uploadingRooms[rr.roomId]}
                                                                canEdit={canEdit}
                                                                onAddPhotos={(e) => handleAddPhotos(rr.roomId, e)}
                                                                onRemove={(idx) => handleRemovePhoto(rr.roomId, idx)}
                                                                onLightbox={setLightboxImage}
                                                            />
                                                        )}
                                                        {!canEdit && rr.photoUrls && rr.photoUrls.length > 0 && (
                                                            <PhotoUploadWidget
                                                                label="Zdjęcia z pokoju"
                                                                photoUrls={rr.photoUrls || []}
                                                                isUploading={false}
                                                                canEdit={false}
                                                                onAddPhotos={() => {}}
                                                                onRemove={() => {}}
                                                                onLightbox={setLightboxImage}
                                                            />
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── Części wspólne ── */}
                    <section>
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <span className="text-base">🏠</span> Części wspólne
                        </h3>
                        <div className="space-y-3 pl-1">
                            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                                <RatingField
                                    label="🍳 Czystość w kuchni"
                                    field="cleanKitchen"
                                    value={form.cleanKitchen}
                                    onChange={(v) => setForm(prev => ({ ...prev, cleanKitchen: v }))}
                                    disabled={!canEdit}
                                />
                                <PhotoUploadWidget
                                    label="Zdjęcia kuchni"
                                    photoUrls={form.kitchenPhotoUrls || []}
                                    isUploading={isUploadingKitchen}
                                    canEdit={canEdit}
                                    onAddPhotos={(e) => handleAddCommonPhotos('kitchen', e)}
                                    onRemove={(idx) => handleRemoveCommonPhoto('kitchen', idx)}
                                    onLightbox={setLightboxImage}
                                />
                            </div>
                            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                                <RatingField
                                    label="🚿 Czystość w łazience"
                                    field="cleanBathroom"
                                    value={form.cleanBathroom}
                                    onChange={(v) => setForm(prev => ({ ...prev, cleanBathroom: v }))}
                                    disabled={!canEdit}
                                />
                                <PhotoUploadWidget
                                    label="Zdjęcia łazienki"
                                    photoUrls={form.bathroomPhotoUrls || []}
                                    isUploading={isUploadingBathroom}
                                    canEdit={canEdit}
                                    onAddPhotos={(e) => handleAddCommonPhotos('bathroom', e)}
                                    onRemove={(idx) => handleRemoveCommonPhoto('bathroom', idx)}
                                    onLightbox={setLightboxImage}
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── Sprzęt ── */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                        <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-muted-foreground" />
                            <Label className="font-medium cursor-pointer text-sm">Wszystkie sprzęty działają?</Label>
                        </div>
                        <Switch
                            disabled={!canEdit}
                            checked={form.appliancesWorking}
                            onCheckedChange={(v) => setForm(prev => ({ ...prev, appliancesWorking: v }))}
                        />
                    </div>

                    {/* ── Komentarze ── */}
                    <div className="space-y-1.5">
                        <Label className="font-medium text-sm">📝 Komentarze / Usterki</Label>
                        <Textarea
                            disabled={!canEdit}
                            placeholder={form.appliancesWorking ? "Dodatkowe uwagi (opcjonalne)..." : "Opisz usterki do naprawy..."}
                            value={form.comments}
                            onChange={(e) => setForm(prev => ({ ...prev, comments: e.target.value }))}
                            className="min-h-[72px] resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} disabled={isPending}>Anuluj</Button>
                    {canEdit && (
                        <Button onClick={handleSave} disabled={isPending} className="shadow-lg shadow-primary/20">
                            {isPending ? 'Zapisuję...' : existingCard ? 'Zaktualizuj' : 'Zapisz kontrolę'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>

            <Lightbox 
                image={lightboxImage} 
                onClose={() => setLightboxImage(null)} 
            />
        </Dialog>
    );
}

// ─── Address row ─────────────────────────────────────────────────────────────

function AddressRow({ address, card, onClick }: { address: Address; card: ControlCard | null; onClick: () => void }) {
    const avg = card ? calculateAverage(card) : 0;
    const hasIssue = card && (!card.appliancesWorking || card.roomRatings.some(r => r.rating < 4) || card.cleanKitchen < 4 || card.cleanBathroom < 4);

    return (
        <button
            onClick={onClick}
            className={`w-full text-left group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150
        hover:shadow-sm hover:border-primary/30
        ${card ? (avg >= 8 ? 'bg-green-500/5 border-green-500/25' : avg >= 4 ? 'bg-yellow-500/5 border-yellow-500/25' : 'bg-red-500/5 border-red-500/25') : 'bg-card border-border/40 hover:bg-accent/20'}`}
        >
            <div className={`shrink-0 rounded-full p-1 ${card ? 'bg-green-500/15' : 'bg-muted'}`}>
                {card ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{address.name}</p>
                {card && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">{card.fillDate}</span>
                        {hasIssue && (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                                <Wrench className="w-2.5 h-2.5" /> Usterka
                            </span>
                        )}
                    </div>
                )}
            </div>

            {card && (
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">Średnia:</span>
                    {ratingBadge(Math.round(avg))}
                </div>
            )}

            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 group-hover:text-primary transition-colors" />
        </button>
    );
}

// ─── Locality Section (single-open accordion behavior) ───────────────────────

function LocalitySection({
    locality, addresses, cardsByAddress, isOpen, onToggle, onAddressClick,
}: {
    locality: string;
    addresses: Address[];
    cardsByAddress: Map<string, ControlCard>;
    isOpen: boolean;
    onToggle: () => void;
    onAddressClick: (address: Address) => void;
}) {
    const done = addresses.filter(a => cardsByAddress.has(a.id)).length;
    const total = addresses.length;
    const allDone = done === total;

    return (
        <div className="border border-border/50 rounded-xl overflow-hidden">
            <button
                onClick={onToggle}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
          ${isOpen ? 'bg-primary/5 border-b border-border/50' : 'hover:bg-muted/40'}`}
            >
                <Building2 className={`w-4 h-4 shrink-0 ${allDone ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{locality}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{done}/{total}</span>
                </div>
                {/* mini progress */}
                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                    />
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="p-3 space-y-1.5">
                            {addresses.map(addr => (
                                <AddressRow
                                    key={addr.id}
                                    address={addr}
                                    card={cardsByAddress.get(addr.id) ?? null}
                                    onClick={() => onAddressClick(addr)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function ControlCardsView({ currentUser }: { currentUser: SessionData }) {
    const { settings } = useMainLayout();
    const { toast } = useToast();

    const monthOptions = useMemo(() => getMonthOptions(), []);
    const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'done'>('all');
    const [controlCards, setControlCards] = useState<ControlCard[]>([]);
    const [isLoadingCards, setIsLoadingCards] = useState(true);
    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [openLocality, setOpenLocality] = useState<string | null>(null);
    const [isUnlocked, setIsUnlocked] = useState(currentUser.isAdmin);

    React.useEffect(() => {
        if (!isUnlocked) return;
        setIsLoadingCards(true);
        fetch('/api/control-cards')
            .then(res => res.json())
            .then((cards: ControlCard[]) => setControlCards(cards))
            .catch(() => toast({ title: 'Błąd', description: 'Nie udało się załadować kart kontroli.', variant: 'destructive' }))
            .finally(() => setIsLoadingCards(false));
    }, []);

    const qualifiedAddresses = useMemo(() => {
        if (!settings) return [];
        return settings.addresses.filter(addr => {
            if (!addr.isActive) return false;
            if (isPrivateAddress(addr.name)) return false;
            if (currentUser.isAdmin) return true;
            return addr.coordinatorIds.includes(currentUser.uid);
        });
    }, [settings, currentUser]);

    // Auto-open first locality on load
    React.useEffect(() => {
        if (qualifiedAddresses.length > 0 && openLocality === null) {
            const first = qualifiedAddresses[0].locality || 'Inne';
            setOpenLocality(first);
        }
    }, [qualifiedAddresses]);

    const cardsByAddressInMonth = useMemo(() => {
        const map = new Map<string, ControlCard>();
        controlCards.forEach(card => {
            if (card.controlMonth === selectedMonth) map.set(card.addressId, card);
        });
        return map;
    }, [controlCards, selectedMonth]);

    const stats = useMemo(() => {
        const total = qualifiedAddresses.length;
        const done = qualifiedAddresses.filter(a => cardsByAddressInMonth.has(a.id)).length;
        return { total, done, pending: total - done };
    }, [qualifiedAddresses, cardsByAddressInMonth]);

    const displayedAddresses = useMemo(() => {
        let list = qualifiedAddresses;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a => a.name.toLowerCase().includes(q) || (a.locality || '').toLowerCase().includes(q));
        }
        if (activeFilter === 'done') list = list.filter(a => cardsByAddressInMonth.has(a.id));
        if (activeFilter === 'pending') list = list.filter(a => !cardsByAddressInMonth.has(a.id));
        return list;
    }, [qualifiedAddresses, search, activeFilter, cardsByAddressInMonth]);

    const grouped = useMemo(() => {
        const map = new Map<string, Address[]>();
        displayedAddresses.forEach(a => {
            const loc = a.locality || 'Inne';
            if (!map.has(loc)) map.set(loc, []);
            map.get(loc)!.push(a);
        });
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [displayedAddresses]);

    const selectedCard = selectedAddress ? cardsByAddressInMonth.get(selectedAddress.id) ?? null : null;

    const handleCardSaved = (card: ControlCard) => {
        setControlCards(prev => {
            const idx = prev.findIndex(c => c.id === card.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = card; return n; }
            return [...prev, card];
        });
    };

    const toggleLocality = (loc: string) => {
        setOpenLocality(prev => prev === loc ? null : loc);
    };

    if (!isUnlocked) {
        return <PINLock onUnlock={() => setIsUnlocked(true)} />;
    }

    if (!settings) {
        return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>;
    }

    return (
        <div className="space-y-5 p-1">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-border/50">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ClipboardCheck className="w-6 h-6 text-primary" />
                        Karty kontroli mieszkań
                    </h1>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Miesięczny raport stanu kwater i pokoi
                    </p>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {monthOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                    <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Adresy</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/5 to-transparent border-green-500/20">
                    <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Skontrolowane</p>
                        <p className="text-2xl font-bold text-green-600">{stats.done}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-500/5 to-transparent border-yellow-500/20">
                    <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Oczekujące</p>
                        <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Progress bar */}
            {stats.total > 0 && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Postęp – {selectedMonth}</span>
                        <span>{stats.done}/{stats.total} ({Math.round(stats.done / stats.total * 100)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                            className="h-full bg-green-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                </div>
            )}

            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Szukaj adresu lub miejscowości..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-1 bg-muted/50 p-1 rounded-lg shrink-0">
                    {(['all', 'pending', 'done'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${activeFilter === f ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {f === 'all' ? 'Wszystkie' : f === 'pending' ? '⏳ Oczekujące' : '✅ Gotowe'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Accordion grouped by locality */}
            {isLoadingCards ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
            ) : grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border/40 rounded-2xl">
                    <Building2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">Brak adresów spełniających kryteria</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {grouped.map(([locality, addresses]) => (
                        <LocalitySection
                            key={locality}
                            locality={locality}
                            addresses={addresses}
                            cardsByAddress={cardsByAddressInMonth}
                            isOpen={openLocality === locality}
                            onToggle={() => toggleLocality(locality)}
                            onAddressClick={setSelectedAddress}
                        />
                    ))}
                </div>
            )}

            {/* Form dialog */}
            {selectedAddress && (
                <ControlCardDialog
                    open={!!selectedAddress}
                    onClose={() => setSelectedAddress(null)}
                    address={selectedAddress}
                    existingCard={selectedCard}
                    currentUser={currentUser}
                    selectedMonth={selectedMonth}
                    onSaved={handleCardSaved}
                />
            )}
        </div>
    );
}
