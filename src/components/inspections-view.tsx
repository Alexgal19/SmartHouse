
"use client";

import React, { useState, useRef } from 'react';
import type { Inspection, Settings, Coordinator, InspectionCategory, InspectionCategoryItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
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
import { PlusCircle, Star, FileImage, Trash2, Camera } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import Image from 'next/image';

interface InspectionsViewProps {
    inspections: Inspection[];
    settings: Settings;
    currentUser: Coordinator;
    onAddInspection: (data: Omit<Inspection, 'id'>) => Promise<void>;
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
            type: z.enum(['rating', 'yes_no', 'text', 'info', 'select']),
            value: z.union([z.number(), z.boolean(), z.string()]).nullable(),
            options: z.array(z.string()).optional()
        })),
        uwagi: z.string().optional(),
    })),
    photos: z.array(z.string()).optional(),
});

type InspectionFormData = z.infer<typeof inspectionSchema>;


const cleanlinessOptions = ["Bardzo czysto", "Czysto", "Brudno", "Bardzo brudno"];

const getInitialChecklist = (): InspectionCategory[] => [
    { 
        name: "Kuchnia", uwagi: "", items: [
            { label: "Czystość kuchnia", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość lodówki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość płyty gazowej, elektrycznej i piekarnika", type: "select", value: null, options: cleanlinessOptions }
        ]
    },
    {
        name: "Łazienka", uwagi: "", items: [
            { label: "Czystość łazienki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość toalety", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość brodzika", type: "select", value: null, options: cleanlinessOptions },
        ]
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
        ]
    },
    {
        name: "Instalacja", uwagi: "", items: [
            { label: "Instalacja gazowa działa", type: "yes_no", value: null },
            { label: "Instalacja internetowa działa", type: "yes_no", value: null },
            { label: "Instalacja elektryczna działa", type: "yes_no", value: null },
            { label: "Instalacja wodno-kanalizacyjna działa", type: "yes_no", value: null },
            { label: "Ogrzewania", type: "text", value: "" },
            { label: "Temperatura w pomieszczeniu", type: "text", value: "" }
        ]
    },
];

const RatingInput = ({ value, onChange, readOnly = false }: { value: number, onChange?: (value: number) => void, readOnly?: boolean }) => {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={`h-6 w-6 ${readOnly ? '' : 'cursor-pointer'} ${value >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                    onClick={() => !readOnly && onChange?.(star)}
                />
            ))}
        </div>
    );
};

const YesNoInput = ({ value, onChange }: { value: boolean | null, onChange: (value: boolean) => void }) => {
    const randomId = React.useId();
    return (
        <RadioGroup onValueChange={(val) => onChange(val === 'true')} value={String(value)} className="flex gap-4">
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

const SelectInput = ({ value, onChange, options }: { value: string | null, onChange: (value: string) => void, options: string[] }) => {
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


const FinalRating = ({ categories }: { categories: InspectionCategory[] }) => {
    const scoreMap: Record<string, number> = {
        "Bardzo czysto": 4,
        "Czysto": 3,
        "Brudno": 1,
        "Bardzo brudno": 0
    };

    const calculation = useMemo(() => {
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
                    if (item.value === true) {
                        totalScore += 1;
                    }
                }
            });
        });

        if (maxScore === 0) return 0;
        const percentage = (totalScore / maxScore) * 100;
        return Math.round((percentage / 100) * 5);

    }, [categories, scoreMap]);

    return (
        <div className="mt-6 p-4 border rounded-lg bg-muted/50 flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Ogólny Ranking Mieszkania</h3>
            <RatingInput value={calculation} readOnly />
            <p className="text-sm text-muted-foreground">Automatycznie obliczony na podstawie inspekcji</p>
        </div>
    );
};

const InspectionDialog = ({ isOpen, onOpenChange, settings, currentUser, onSave }: { isOpen: boolean, onOpenChange: (open: boolean) => void, settings: Settings, currentUser: Coordinator, onSave: (data: Omit<Inspection, 'id'>) => Promise<void> }) => {
    const form = useForm<InspectionFormData>({
        resolver: zodResolver(inspectionSchema),
        defaultValues: {
            addressId: '',
            date: new Date(),
            coordinatorId: currentUser.uid,
            standard: null,
            categories: getInitialChecklist(),
            photos: [],
        }
    });
    
    const { fields } = useFieldArray({ control: form.control, name: "categories" });
    const watchedCategories = useWatch({ control: form.control, name: 'categories' });
    const watchedPhotos = useWatch({ control: form.control, name: 'photos' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const currentPhotos = form.getValues('photos') || [];
            const newPhotos: string[] = [];
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    newPhotos.push(reader.result as string);
                    if (newPhotos.length === files.length) {
                        form.setValue('photos', [...currentPhotos, ...newPhotos]);
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removePhoto = (index: number) => {
        const currentPhotos = form.getValues('photos') || [];
        form.setValue('photos', currentPhotos.filter((_, i) => i !== index));
    };

    const onSubmit = async (data: InspectionFormData) => {
        const address = settings.addresses.find(a => a.id === data.addressId);
        if (!address) {
            form.setError("addressId", { message: "Nie znaleziono adresu." });
            return;
        }
        
        await onSave({
            addressId: data.addressId,
            addressName: address.name,
            date: data.date,
            coordinatorId: currentUser.uid,
            coordinatorName: currentUser.name,
            standard: data.standard,
            categories: data.categories,
            photos: data.photos || [],
        });
        form.reset({
            addressId: '',
            date: new Date(),
            coordinatorId: currentUser.uid,
            standard: null,
            categories: getInitialChecklist(),
            photos: [],
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Nowa Kontrola Mieszkania</DialogTitle>
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
                                            <DatePicker value={field.value} onChange={field.onChange} />
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormItem>
                                        <FormLabel>Koordynator</FormLabel>
                                        <FormControl><Input value={currentUser.name} readOnly disabled /></FormControl>
                                    </FormItem>
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
                                        <CardHeader><CardTitle>{categoryField.name}</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            {categoryField.items.map((item, itemIndex) => {
                                                const fieldName = `categories.${categoryIndex}.items.${itemIndex}.value`;
                                                return (
                                                    <FormField
                                                        key={`${categoryField.id}-${itemIndex}`}
                                                        control={form.control}
                                                        name={fieldName as any}
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border p-3">
                                                                <FormLabel>{item.label}</FormLabel>
                                                                <FormControl>
                                                                    <div>
                                                                        {item.type === 'rating' && <RatingInput value={field.value as number} onChange={field.onChange} />}
                                                                        {item.type === 'yes_no' && <YesNoInput value={field.value as boolean | null} onChange={field.onChange} />}
                                                                        {item.type === 'text' && <Textarea {...field} className="w-full sm:w-64" />}
                                                                        {item.type === 'select' && item.options && <SelectInput value={field.value as string | null} onChange={field.onChange} options={item.options} />}
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
                                                        <FormControl><Textarea {...field} placeholder="Dodatkowe uwagi..." /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </CardContent>
                                    </Card>
                                ))}
                                </div>
                                <Card>
                                    <CardHeader><CardTitle>Zdjęcia</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex gap-2 mb-4">
                                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                <FileImage className="mr-2 h-4 w-4" />
                                                Załaduj z urządzenia
                                            </Button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                multiple
                                                onChange={handleFileChange}
                                            />
                                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled>
                                                <Camera className="mr-2 h-4 w-4" />
                                                Zrób zdjęcie
                                            </Button>
                                             <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handleFileChange}
                                                // We can use the same ref for simplicity or a new one
                                                // onClick={(e) => (e.currentTarget.value = null)} // Allows re-taking photo
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                            {(watchedPhotos || []).map((photoSrc, index) => (
                                                <div key={index} className="relative group aspect-square">
                                                    <Image src={photoSrc} alt={`Inspection photo ${index + 1}`} layout="fill" objectFit="cover" className="rounded-md" />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="destructive" size="icon" type="button" onClick={() => removePhoto(index)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                                <FinalRating categories={watchedCategories} />
                            </div>
                        </ScrollArea>
                        <DialogFooter className="mt-6">
                            <DialogClose asChild><Button type="button" variant="secondary">Anuluj</Button></DialogClose>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Zapisywanie..." : "Zapisz Inspekcję"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};


export default function InspectionsView({ inspections, settings, currentUser, onAddInspection }: InspectionsViewProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Inspekcje</CardTitle>
                    <Button onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Dodaj inspekcję</Button>
                </div>
                <CardDescription>Historia przeprowadzonych kontroli mieszkań.</CardDescription>
            </CardHeader>
            <CardContent>
                {inspections.length > 0 ? (
                    <div className="space-y-4">
                        {inspections.map(inspection => (
                             <Card key={inspection.id}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{inspection.addressName}</CardTitle>
                                    <CardDescription>
                                        {format(inspection.date, 'd MMMM yyyy', { locale: pl })} przez {inspection.coordinatorName}
                                    </CardDescription>
                                </CardHeader>
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
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                settings={settings}
                currentUser={currentUser}
                onSave={onAddInspection}
            />
        </Card>
    );
}


    