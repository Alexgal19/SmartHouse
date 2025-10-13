
"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type { Inspection, Settings, Coordinator, InspectionCategory, InspectionCategoryItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { PlusCircle, Star, FileImage, Trash2, Camera, MoreVertical, Pencil, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import Image from 'next/image';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Checkbox } from './ui/checkbox';


interface InspectionsViewProps {
    inspections: Inspection[];
    settings: Settings;
    currentUser: Coordinator;
    onAddInspection: (data: Omit<Inspection, 'id'>) => Promise<void>;
    onUpdateInspection: (id: string, data: Omit<Inspection, 'id'>) => Promise<void>;
    onDeleteInspection: (id: string) => Promise<void>;
}

const inspectionSchema = z.object({
    addressId: z.string().min(1, "Adres jest wymagany."),
    date: z.date({ required_error: "Data jest wymagana." }),
    coordinatorId: z.string(),
    standard: z.enum(['Wysoki', 'Normalny', 'Niski']).nullable(),
    categories: z.array(z.object({
        name: z.string(),
        items: z.array(z.object({
            label: z.string(),
            type: z.enum(['rating', 'yes_no', 'text', 'info', 'select', 'checkbox_group', 'number']),
            value: z.any(),
            options: z.array(z.string()).optional()
        })),
        uwagi: z.string().optional(),
        photos: z.array(z.string()).optional(),
    })),
});

type InspectionFormData = z.infer<typeof inspectionSchema>;


const cleanlinessOptions = ["Bardzo czysto", "Czysto", "Brudno", "Bardzo brudno"];

const getInitialChecklist = (): InspectionCategory[] => [
    {
        name: "Kuchnia", uwagi: "", items: [
            { label: "Czystość kuchnia", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość lodówki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość płyty gazowej, elektrycznej i piekarnika", type: "select", value: null, options: cleanlinessOptions }
        ], photos: []
    },
    {
        name: "Łazienka", uwagi: "", items: [
            { label: "Czystość łazienki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość toalety", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość brodzika", type: "select", value: null, options: cleanlinessOptions },
        ], photos: []
    },
    {
        name: "Pokoje", uwagi: "", items: [
            { label: "Czystość pokoju", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czy niema pleśni w pomieszczeniach?", type: "yes_no", value: null },
            { label: "Łóżka niepołamane", type: "yes_no", value: null },
            { label: "Sciany czyste", type: "yes_no", value: null },
            { label: "Szafy i szafki czyste", type: "yes_no", value: null },
            { label: "Stare rzeczy wyrzucane", type: "yes_no", value: null },
            { label: "Pościel czysta", type: "yes_no", value: null },
            { label: "Wyposażenia niezniszczone", type: "yes_no", value: null },
        ], photos: []
    },
    {
        name: "Instalacja", uwagi: "", items: [
            { label: "Instalacja gazowa działa", type: "yes_no", value: null },
            { label: "Instalacja internetowa działa", type: "yes_no", value: null },
            { label: "Instalacja elektryczna działa", type: "yes_no", value: null },
            { label: "Instalacja wodno-kanalizacyjna działa", type: "yes_no", value: null },
            { label: "Ogrzewania", type: "text", value: "" },
            { label: "Temperatura w pomieszczeniu", type: "text", value: "" }
        ], photos: []
    },
    {
        name: "Liczniki", uwagi: "", items: [], photos: []
    },
];

const RatingInput = ({ value, onChange, readOnly = false }: { value: number | null, onChange?: (value: number) => void, readOnly?: boolean }) => {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={`h-6 w-6 ${readOnly ? '' : 'cursor-pointer'} ${(value || 0) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                    onClick={() => !readOnly && onChange?.(star)}
                />
            ))}
        </div>
    );
};

const YesNoInput = ({ value, onChange, readOnly = false }: { value: boolean | null, onChange?: (value: boolean) => void, readOnly?: boolean }) => {
    const randomId = React.useId();
    if(readOnly){
        if (value === null) return <Badge variant="secondary">Brak</Badge>
        return <Badge variant={value ? "secondary" : "destructive"}>{value ? 'Tak' : 'Nie'}</Badge>
    }
    return (
        <RadioGroup onValueChange={(val) => onChange?.(val === 'true')} value={String(value)} className="flex gap-4">
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id={`yes-${randomId}`} />
                <Label htmlFor={`yes-${randomId}`}>Tak</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id={`no-${randomId}`} />
                <Label htmlFor={`no-${randomId}`}>Nie</Label>
            </div>
        </RadioGroup>
    );
}

const CheckboxGroupInput = ({ value, onChange, options, readOnly = false }: { value: string[] | null, onChange?: (value: string[]) => void, options: string[], readOnly?: boolean }) => {
    const currentValues = value || [];
    
    if (readOnly) {
        if (currentValues.length === 0) return <Badge variant="secondary">Brak</Badge>;
        return (
            <div className="flex flex-wrap gap-2">
                {currentValues.map(v => <Badge key={v} variant="secondary">{v}</Badge>)}
            </div>
        )
    }

    const handleCheckedChange = (checked: boolean, option: string) => {
        let newValues: string[];
        if (checked) {
            newValues = [...currentValues, option];
        } else {
            newValues = currentValues.filter(v => v !== option);
        }
        onChange?.(newValues);
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {options.map(option => (
                <div key={option} className="flex items-center gap-2">
                    <Checkbox
                        id={option}
                        checked={currentValues.includes(option)}
                        onCheckedChange={(checked) => handleCheckedChange(checked as boolean, option)}
                    />
                    <Label htmlFor={option} className="text-sm font-normal">{option}</Label>
                </div>
            ))}
        </div>
    );
};


const SelectInput = ({ value, onChange, options, readOnly = false }: { value: string | null, onChange?: (value: string) => void, options: string[], readOnly?: boolean }) => {
     if(readOnly){
        return <Badge variant="secondary">{value || 'Brak'}</Badge>
    }
    return (
        <Select onValueChange={onChange} value={value || ''}>
            <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Wybierz ocenę" />
            </SelectTrigger>
            <SelectContent>
                {options.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

const CameraCapture = ({ isOpen, onOpenChange, onCapture }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onCapture: (dataUri: string) => void }) => {
    const { toast } = useToast();
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    },[]);
    
    useEffect(() => {
        const getCameraPermission = async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setHasCameraPermission(true);
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
              variant: 'destructive',
              title: 'Brak dostępu do kamery',
              description: 'Proszę zezwolić na dostęp do kamery w ustawieniach przeglądarki.',
            });
          }
        };
    
        if (isOpen) {
          getCameraPermission();
        } else {
            stopCamera();
        }
    
        return () => {
          stopCamera();
        };
      }, [isOpen, toast, stopCamera]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            
            const MAX_WIDTH = 1024;
            const scale = MAX_WIDTH / video.videoWidth;
            canvas.width = MAX_WIDTH;
            canvas.height = video.videoHeight * scale;

            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const dataUri = canvas.toDataURL('image/jpeg', 0.7);
            onCapture(dataUri);
            onOpenChange(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>Зробіть фото</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-4">
                     <div className="w-full relative">
                        <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
                         {hasCameraPermission === false && (
                             <div className="absolute inset-0 flex items-center justify-center">
                                <Alert variant="destructive">
                                    <AlertTitle>Brak dostępu do kamery</AlertTitle>
                                    <AlertDescription>
                                        Proszę zezwolić na dostęp do kamery.
                                    </AlertDescription>
                                </Alert>
                             </div>
                        )}
                    </div>
                     <canvas ref={canvasRef} className="hidden" />
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Anuluj</Button>
                    <Button onClick={handleCapture} disabled={!hasCameraPermission}>Зробіть фото</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};


const calculateRating = (categories: InspectionCategory[]): number => {
    const scoreMap: Record<string, number> = {
        "Bardzo czysto": 4, "Czysto": 3, "Brudno": 1, "Bardzo brudno": 0
    };
    let totalScore = 0;
    let maxScore = 0;

    categories.forEach(category => {
        category.items.forEach(item => {
            if (item.type === 'select' && item.options && item.options.every(o => cleanlinessOptions.includes(o))) {
                maxScore += 4;
                if (typeof item.value === 'string' && item.value in scoreMap) {
                    totalScore += scoreMap[item.value];
                }
            } else if (item.type === 'yes_no') {
                maxScore += 1;
                if (item.value === true) totalScore += 1;
            }
        });
    });

    if (maxScore === 0) return 0;
    const percentage = (totalScore / maxScore) * 100;
    return Math.round((percentage / 100) * 5);
};

const FinalRating = ({ categories, isCalculated = false }: { categories: InspectionCategory[], isCalculated?: boolean }) => {
    const rating = useMemo(() => calculateRating(categories), [categories]);

    return (
        <div className="mt-6 p-4 border rounded-lg bg-muted/50 flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Ogólny Ranking Mieszkania</h3>
            <RatingInput value={rating} readOnly />
            {isCalculated && <p className="text-sm text-muted-foreground">Automatycznie obliczony na podstawie inspekcji</p>}
        </div>
    );
};

const InspectionDialog = ({ 
    isOpen, 
    onOpenChange, 
    settings, 
    currentUser, 
    onSave,
    editingInspection 
}: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void; 
    settings: Settings; 
    currentUser: Coordinator; 
    onSave: (data: Omit<Inspection, 'id'>, id?: string) => Promise<void>;
    editingInspection: Inspection | null;
}) => {
    const form = useForm<InspectionFormData>({
        resolver: zodResolver(inspectionSchema),
    });
    
    useEffect(() => {
        if(isOpen) {
            if (editingInspection) {
                 const currentCategories = editingInspection.categories || [];
                const fullChecklist = getInitialChecklist();
                
                const mergedCategories = fullChecklist.map(checklistCategory => {
                    const existingCategory = currentCategories.find(c => c.name === checklistCategory.name);
                    if (existingCategory) {
                        const mergedItems = checklistCategory.items.map(checklistItem => {
                            const existingItem = existingCategory.items.find(i => i.label === checklistItem.label);
                            return existingItem ? { ...checklistItem, ...existingItem } : checklistItem;
                        });
                        return { ...checklistCategory, ...existingCategory, items: mergedItems };
                    }
                    return checklistCategory;
                });

                form.reset({
                    addressId: editingInspection.addressId,
                    date: editingInspection.date,
                    coordinatorId: editingInspection.coordinatorId,
                    standard: editingInspection.standard,
                    categories: mergedCategories,
                });
            } else {
                 form.reset({
                    addressId: '',
                    date: new Date(),
                    coordinatorId: currentUser.uid,
                    standard: null,
                    categories: getInitialChecklist(),
                });
            }
        }
    }, [isOpen, editingInspection, currentUser, form]);

    
    const { fields, update } = useFieldArray({ control: form.control, name: "categories" });
    const watchedCategories = useWatch({ control: form.control, name: 'categories' });
    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [activeCategoryForCamera, setActiveCategoryForCamera] = useState<number | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, categoryIndex: number) => {
        const files = event.target.files;
        if (files) {
          const filePromises = Array.from(files).map((file) => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          });
    
          Promise.all(filePromises).then((newPhotos) => {
            const category = form.getValues(`categories.${categoryIndex}`);
            const currentPhotos = category.photos || [];
            update(categoryIndex, { ...category, photos: [...currentPhotos, ...newPhotos] });
          });
        }
    
        if (event.target) {
          event.target.value = '';
        }
    };

    const openCameraForCategory = (categoryIndex: number) => {
        setActiveCategoryForCamera(categoryIndex);
        setIsCameraOpen(true);
    };

    const handlePhotoCapture = (dataUri: string) => {
        if (activeCategoryForCamera !== null) {
            const category = form.getValues(`categories.${activeCategoryForCamera}`);
            const currentPhotos = category.photos || [];
            update(activeCategoryForCamera, { ...category, photos: [...currentPhotos, dataUri] });
            setActiveCategoryForCamera(null);
        }
    };

    const removePhoto = (categoryIndex: number, photoIndex: number) => {
        const category = form.getValues(`categories.${categoryIndex}`);
        const currentPhotos = category.photos || [];
        update(categoryIndex, { ...category, photos: currentPhotos.filter((_, i) => i !== photoIndex) });
    };

    const onSubmit = async (data: InspectionFormData) => {
        const address = settings.addresses.find(a => a.id === data.addressId);
        if (!address) {
            form.setError("addressId", { message: "Nie znaleziono adresu." });
            return;
        }

        const coordinator = settings.coordinators.find(c => c.uid === data.coordinatorId);
         if (!coordinator) {
            form.setError("coordinatorId", { message: "Nie znaleziono koordynatora." });
            return;
        }

        const inspectionData: Omit<Inspection, 'id'> = {
            addressId: data.addressId,
            addressName: address.name,
            date: data.date,
            coordinatorId: data.coordinatorId,
            coordinatorName: coordinator.name,
            standard: data.standard,
            categories: data.categories,
        };
        
        await onSave(inspectionData, editingInspection?.id);
        
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>{editingInspection ? "Edytuj Inspekcję" : "Nowa Kontrola Mieszkania"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <ScrollArea className="h-[70vh] p-1">
                            <div className="space-y-6 pr-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="addressId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Adres</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Wybierz adres" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {settings.addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="date" render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="mb-1.5">Data wypełnienia</FormLabel>
                                            <DatePicker value={field.value.toISOString()} onChange={(val) => field.onChange(val ? new Date(val) : new Date())} />
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <FormField control={form.control} name="coordinatorId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Koordynator</FormLabel>
                                             <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Wybierz koordynatora" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                {settings.coordinators.map(c => (
                                                    <SelectItem key={c.uid} value={c.uid}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="standard" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Standard mieszkania</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Wybierz standard" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {['Wysoki', 'Normalny', 'Niski'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="space-y-6">
                                {fields.map((categoryField, categoryIndex) => (
                                    <Card key={categoryField.id}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle>{categoryField.name}</CardTitle>
                                                <div className="flex items-center gap-2">
                                                    <Button type="button" variant="outline" size="icon" onClick={() => fileInputRefs.current[categoryIndex]?.click()}>
                                                        <FileImage className="h-4 w-4" />
                                                    </Button>
                                                    <Button type="button" variant="outline" size="icon" onClick={() => openCameraForCategory(categoryIndex)}>
                                                        <Camera className="h-4 w-4" />
                                                    </Button>
                                                    <input
                                                        type="file"
                                                        ref={(el) => (fileInputRefs.current[categoryIndex] = el)}
                                                        className="hidden"
                                                        accept="image/*"
                                                        multiple
                                                        onChange={(e) => handleFileChange(e, categoryIndex)}
                                                    />
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {categoryField.items.map((item, itemIndex) => {
                                                const fieldName = `categories.${categoryIndex}.items.${itemIndex}.value`;
                                                return (
                                                    <FormField
                                                        key={`${categoryField.id}-${itemIndex}`}
                                                        control={form.control}
                                                        name={fieldName as any}
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col sm:flex-row sm:items-start sm:justify-between rounded-md border p-3 gap-3">
                                                                <FormLabel className="pt-2">{item.label}</FormLabel>
                                                                <FormControl>
                                                                    <div className="w-full sm:w-auto">
                                                                        {item.type === 'rating' && <RatingInput value={field.value as number | null} onChange={field.onChange} />}
                                                                        {item.type === 'yes_no' && <YesNoInput value={field.value as boolean | null} onChange={field.onChange} />}
                                                                        {item.type === 'text' && <Textarea {...field} value={field.value || ''} className="w-full sm:w-64" />}
                                                                        {item.type === 'number' && <Input type="number" {...field} value={field.value ?? ''} className="w-full sm:w-48" onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />}
                                                                        {item.type === 'select' && item.options && <SelectInput value={field.value as string | null} onChange={field.onChange} options={item.options} />}
                                                                        {item.type === 'checkbox_group' && item.options && <CheckboxGroupInput value={field.value as string[] | null} onChange={field.onChange} options={item.options} />}
                                                                    </div>
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                )
                                            })}
                                             <FormField
                                                control={form.control}
                                                name={`categories.${categoryIndex}.uwagi`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Uwagi</FormLabel>
                                                        <FormControl><Textarea {...field} value={field.value || ''} placeholder="Dodatkowe uwagi..." /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                {(watchedCategories?.[categoryIndex]?.photos || []).map((photoSrc, photoIndex) => (
                                                    <div key={photoIndex} className="relative group aspect-square">
                                                        <Image src={photoSrc} alt={`Photo ${photoIndex + 1}`} layout="fill" objectFit="cover" className="rounded-md" />
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="destructive" size="icon" type="button" onClick={() => removePhoto(categoryIndex, photoIndex)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                </div>
                                
                                <FinalRating categories={watchedCategories || []} isCalculated />
                            </div>
                        </ScrollArea>
                        <DialogFooter className="mt-6">
                            <DialogClose asChild><Button type="button" variant="secondary">Anuluj</Button></DialogClose>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Zapisywanie..." : (editingInspection ? "Zapisz zmiany" : "Zapisz Inspekcję")}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
                 <CameraCapture isOpen={isCameraOpen} onOpenChange={setIsCameraOpen} onCapture={handlePhotoCapture} />
            </DialogContent>
        </Dialog>
    );
};

const InspectionDetailDialog = ({ inspection, isOpen, onOpenChange }: { inspection: Inspection | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) => {
    const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<{src: string, index: number}>({src: '', index: 0});
    
    const allPhotos = useMemo(() => {
        if (!inspection) return [];
        return inspection.categories.flatMap(cat => cat.photos || []).map(src => src);
    }, [inspection]);

    const openPhotoViewer = (photoSrc: string) => {
        const index = allPhotos.findIndex(p => p === photoSrc);
        setSelectedPhoto({src: photoSrc, index: index});
        setIsPhotoViewerOpen(true);
    };

    const nextPhoto = () => {
        const nextIndex = (selectedPhoto.index + 1) % allPhotos.length;
        setSelectedPhoto({src: allPhotos[nextIndex], index: nextIndex});
    };
    const prevPhoto = () => {
        const prevIndex = (selectedPhoto.index - 1 + allPhotos.length) % allPhotos.length;
        setSelectedPhoto({src: allPhotos[prevIndex], index: prevIndex});
    };

    if (!inspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>{inspection.addressName}</DialogTitle>
                    <DialogDescription>
                        Inspekcja z dnia {format(inspection.date, 'dd-MM-yyyy, HH:mm')} przez {inspection.coordinatorName}
                    </DialogDescription>
                    {inspection.standard && <Badge className="w-fit">{inspection.standard}</Badge>}
                </DialogHeader>
                <ScrollArea className="h-[70vh] p-1 pr-4">
                    <div className="space-y-6">
                        {inspection.categories.map(category => (
                            <Card key={category.name}>
                                <CardHeader><CardTitle>{category.name}</CardTitle></CardHeader>
                                <CardContent>
                                    {category.items.length > 0 && <ul className="space-y-3">
                                    {category.items.map((item, index) => (
                                        <li key={`${item.label}-${index}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm">
                                            <span className="font-medium">{item.label}</span>
                                            <div>
                                                {item.type === 'yes_no' && <YesNoInput readOnly value={item.value as boolean | null} />}
                                                {item.type === 'select' && item.options && <SelectInput readOnly options={item.options} value={item.value as string | null} />}
                                                {item.type === 'number' && <p className="text-muted-foreground">{item.value !== null ? `${item.value}` : 'N/A'}</p>}
                                                {item.type === 'text' && <p className="text-muted-foreground">{item.value as string || 'N/A'}</p>}
                                                {item.type === 'rating' && <RatingInput value={item.value as number | null} readOnly />}
                                                {item.type === 'checkbox_group' && <CheckboxGroupInput readOnly options={item.options || []} value={item.value as string[] | null} />}
                                            </div>
                                        </li>
                                    ))}
                                    </ul>}
                                    {category.uwagi && (
                                        <div className="mt-4 pt-3 border-t">
                                            <h4 className="font-semibold text-sm">Uwagi:</h4>
                                            <p className="text-sm text-muted-foreground italic">"{category.uwagi}"</p>
                                        </div>
                                    )}
                                     {category.photos && category.photos.length > 0 && (
                                        <div className="mt-4 pt-4 border-t">
                                             <h4 className="font-semibold text-sm mb-2">Zdjęcia:</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                {category.photos.map((photo, index) => (
                                                    <div key={index} className="relative aspect-square cursor-pointer" onClick={() => openPhotoViewer(photo)}>
                                                        <Image src={photo} alt={`Photo ${index + 1}`} layout="fill" objectFit="cover" className="rounded-md border" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                        <FinalRating categories={inspection.categories} />
                    </div>
                </ScrollArea>
                 <DialogFooter>
                    <Button type="button" onClick={() => onOpenChange(false)}>Zamknij</Button>
                </DialogFooter>
                
                <Dialog open={isPhotoViewerOpen} onOpenChange={setIsPhotoViewerOpen}>
                    <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                       <DialogHeader>
                          <DialogTitle>Zdjęcie {selectedPhoto.index + 1} z {allPhotos.length}</DialogTitle>
                       </DialogHeader>
                        <div className="relative flex-1 flex items-center justify-center">
                            <Image 
                                src={selectedPhoto.src} 
                                alt={`Inspection photo ${selectedPhoto.index + 1}`} 
                                layout="fill" 
                                objectFit="contain" 
                            />
                        </div>
                        <DialogFooter className="flex-row justify-between items-center w-full">
                            <Button variant="outline" size="icon" onClick={prevPhoto} disabled={allPhotos.length <= 1}>
                                <ChevronLeft className="h-6 w-6"/>
                            </Button>
                             <Button variant="outline" onClick={() => setIsPhotoViewerOpen(false)}>Zamknij</Button>
                             <Button variant="outline" size="icon" onClick={nextPhoto} disabled={allPhotos.length <= 1}>
                                <ChevronRight className="h-6 w-6"/>
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </DialogContent>
        </Dialog>
    )
}

export default function InspectionsView({ inspections, settings, currentUser, onAddInspection, onUpdateInspection, onDeleteInspection }: InspectionsViewProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
    const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

    const handleOpenForm = (inspection: Inspection | null) => {
        setEditingInspection(inspection);
        setIsFormOpen(true);
    };

    const handleSave = async (data: Omit<Inspection, 'id'>, id?: string) => {
        if(id) {
            await onUpdateInspection(id, data);
        } else {
            await onAddInspection(data);
        }
    };
    
    const handleDelete = async (inspectionId: string) => {
        await onDeleteInspection(inspectionId);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Inspekcje</CardTitle>
                    <Button onClick={() => handleOpenForm(null)}><PlusCircle className="mr-2 h-4 w-4" /> Dodaj inspekcję</Button>
                </div>
                <CardDescription>Historia przeprowadzonych kontroli mieszkań.</CardDescription>
            </CardHeader>
            <CardContent>
                {inspections.length > 0 ? (
                    <div className="space-y-4">
                        {inspections.map(inspection => (
                             <Card key={inspection.id} className="animate-in fade-in-0 duration-300">
                                <CardHeader className="flex-row items-center justify-between">
                                    <div className="cursor-pointer flex-1" onClick={() => setSelectedInspection(inspection)}>
                                        <CardTitle className="text-lg">{inspection.addressName}</CardTitle>
                                        <CardDescription>
                                            {format(inspection.date, 'dd-MM-yyyy')} przez {inspection.coordinatorName}
                                        </CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="flex-shrink-0">
                                                <MoreVertical className="h-4 w-4"/>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleOpenForm(inspection)}>
                                                <Pencil className="mr-2 h-4 w-4" /> Edytuj
                                            </DropdownMenuItem>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Usuń
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Czy na pewno chcesz usunąć?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Tej operacji nie można cofnąć. Spowoduje to trwałe usunięcie inspekcji.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(inspection.id)} className="bg-destructive hover:bg-destructive/90">
                                                            Usuń
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>
                                <CardContent className="cursor-pointer" onClick={() => setSelectedInspection(inspection)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">Ocena:</span>
                                        <RatingInput value={calculateRating(inspection.categories)} readOnly/>
                                    </div>
                                </CardContent>
                             </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">Brak zarejestrowanych inspekcji.</p>
                        <p className="text-muted-foreground">Kliknij "Dodaj inspekcję", aby rozpocząć.</p>
                    </div>
                )}
            </CardContent>
            
            <InspectionDialog 
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                settings={settings}
                currentUser={currentUser}
                onSave={handleSave}
                editingInspection={editingInspection}
            />
            
            <InspectionDetailDialog 
                isOpen={!!selectedInspection}
                onOpenChange={(isOpen) => { if(!isOpen) setSelectedInspection(null) }}
                inspection={selectedInspection}
            />
        </Card>
    );
}

    