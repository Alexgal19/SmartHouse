

// This component manages the view for housing inspections.
// It allows creating, viewing, and editing inspection reports.

"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMainLayout } from '@/components/main-layout';
import type { Inspection, Settings, SessionData, InspectionCategory, InspectionCategoryItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Calendar as CalendarIcon, X, Camera, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const defaultCategories: Omit<InspectionCategory, 'items'> & { items: Omit<InspectionCategoryItem, 'value'>[] }[] = [
    { name: 'Kuchnia', uwagi: '', photos: [], items: [
        { label: 'Czystość ogólna', type: 'select', options: ['Bardzo czysto', 'Czysto', 'Brudno', 'Bardzo brudno'] },
        { label: 'Lodówka (czystość)', type: 'yes_no' },
        { label: 'Kuchenka (czystość)', type: 'yes_no' },
        { label: 'Zlew (czystość)', type: 'yes_no' },
    ]},
    { name: 'Łazienka', uwagi: '', photos: [], items: [
        { label: 'Czystość ogólna', type: 'select', options: ['Bardzo czysto', 'Czysto', 'Brudno', 'Bardzo brudno'] },
        { label: 'Prysznic/wanna', type: 'yes_no' },
        { label: 'Toaleta', type: 'yes_no' },
        { label: 'Umywalka', type: 'yes_no' },
    ]},
    { name: 'Pokój', uwagi: '', photos: [], items: [
        { label: 'Porządek ogólny', type: 'rating' },
        { label: 'Stan mebli', type: 'yes_no' },
        { label: 'Stan pościeli', type: 'yes_no' },
    ]},
    { name: 'Inne', uwagi: '', photos: [], items: [
        { label: 'Segregacja śmieci', type: 'yes_no' },
        { label: 'Obecność szkodników', type: 'yes_no' },
    ]},
];

const inspectionItemSchema = z.object({
  label: z.string(),
  type: z.enum(['text', 'number', 'select', 'yes_no', 'rating', 'checkbox_group']),
  value: z.any(),
  options: z.array(z.string()).optional(),
});

const categorySchema = z.object({
    name: z.string(),
    items: z.array(inspectionItemSchema),
    uwagi: z.string().optional(),
    photos: z.array(z.string()).optional(),
});

const formSchema = z.object({
  addressId: z.string().min(1, 'Adres jest wymagany.'),
  date: z.date({ required_error: 'Data inspekcji jest wymagana.' }),
  standard: z.string().optional(),
  categories: z.array(categorySchema),
});

const renderFormControl = (item: InspectionCategoryItem, field: any) => {
    switch (item.type) {
        case 'yes_no':
            return (
                <RadioGroup onValueChange={(val) => field.onChange(val === 'true')} value={String(field.value)} className="flex items-center space-x-4">
                    <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="true" /></FormControl>
                        <FormLabel className="font-normal">Tak</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="false" /></FormControl>
                        <FormLabel className="font-normal">Nie</FormLabel>
                    </FormItem>
                </RadioGroup>
            );
        case 'rating':
            return (
                <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map(v => (
                        <Button key={v} type="button" variant={field.value === v ? 'default' : 'outline'} size="icon" onClick={() => field.onChange(v)}>{v}</Button>
                    ))}
                </div>
            );
        case 'select':
            return (
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz opcję" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {item.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                </Select>
            );
        default:
            return <Input {...field} />;
    }
}


export const InspectionForm = ({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  currentUser,
  item,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Inspection, 'id' | 'addressName' | 'coordinatorName'>, id?: string) => void;
  settings: Settings;
  currentUser: SessionData;
  item: Inspection | null;
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        form.reset({
          addressId: item.addressId,
          date: new Date(item.date),
          standard: item.standard || '',
          categories: item.categories,
        });
      } else {
        const initialCategories = defaultCategories.map(cat => ({
            ...cat,
            items: cat.items.map(it => {
                let defaultValue: any = '';
                if (it.type === 'yes_no') defaultValue = null;
                if (it.type === 'rating') defaultValue = 3;
                if (it.type === 'select') defaultValue = it.options?.[0] || '';
                return { ...it, value: defaultValue };
            })
        }));
        form.reset({
          addressId: '',
          date: new Date(),
          standard: '',
          categories: initialCategories
        });
      }
    }
  }, [item, isOpen, form]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, categoryIndex: number) => {
    const files = event.target.files;
    if (files) {
        const categoryPath = `categories.${categoryIndex}.photos`;
        const existingPhotos = form.getValues(categoryPath) || [];
        const newPhotos: string[] = [];
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === 'string') {
                    newPhotos.push(e.target.result);
                    if (newPhotos.length === files.length) {
                        form.setValue(categoryPath, [...existingPhotos, ...newPhotos]);
                    }
                }
            };
            reader.readAsDataURL(file);
        });
    }
  };

  const removePhoto = (categoryIndex: number, photoIndex: number) => {
    const categoryPath = `categories.${categoryIndex}.photos`;
    const existingPhotos = form.getValues(categoryPath) || [];
    const updatedPhotos = existingPhotos.filter((_, i) => i !== photoIndex);
    form.setValue(categoryPath, updatedPhotos);
  };
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const formattedDate = format(values.date, 'yyyy-MM-dd');
    const inspectionData = {
        ...values,
        date: formattedDate,
        coordinatorId: currentUser.uid,
    };
    onSave(inspectionData, item?.id);
  };

  const { fields: categoryFields } = useFieldArray({
    control: form.control,
    name: 'categories',
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DialogHeader>
          <DialogTitle>{item ? 'Edytuj inspekcję' : 'Nowa inspekcja'}</DialogTitle>
          <DialogDescription>Wypełnij raport z inspekcji mieszkania.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[70vh] p-1">
                 <div className="space-y-4 px-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField
                            control={form.control}
                            name="addressId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Adres</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz adres" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                    {settings.addresses.map((address) => (
                                        <SelectItem key={address.id} value={address.id}>{address.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Data inspekcji</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, 'PPP', { locale: pl }) : <span>Wybierz datę</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                     </div>
                     <FormField
                        control={form.control}
                        name="standard"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ogólny standard</FormLabel>
                                 <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Oceń ogólny standard mieszkania" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Wysoki">Wysoki</SelectItem>
                                        <SelectItem value="Normalny">Normalny</SelectItem>
                                        <SelectItem value="Niski">Niski</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                      />
                     
                    <Accordion type="multiple" className="w-full">
                        {categoryFields.map((category, categoryIndex) => (
                            <AccordionItem key={category.id} value={category.name}>
                                <AccordionTrigger>{category.name}</AccordionTrigger>
                                <AccordionContent>
                                    <ScrollArea className="max-h-64">
                                        <div className="space-y-6 p-4">
                                            {(form.getValues(`categories.${categoryIndex}.items`) || []).map((item, itemIndex) => (
                                                <FormField
                                                    key={`${category.id}-${item.label}`}
                                                    control={form.control}
                                                    name={`categories.${categoryIndex}.items.${itemIndex}.value`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{item.label}</FormLabel>
                                                            <FormControl>{renderFormControl(item, field)}</FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                            <FormField
                                                control={form.control}
                                                name={`categories.${categoryIndex}.uwagi`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Uwagi</FormLabel>
                                                        <FormControl><Textarea {...field} /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormItem>
                                                <FormLabel>Zdjęcia</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <Button type="button" variant="outline" onClick={() => { setActiveCategoryIndex(categoryIndex); fileInputRef.current?.click(); }}>
                                                        <Camera className="mr-2 h-4 w-4" /> Dodaj zdjęcia
                                                    </Button>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {(form.watch(`categories.${categoryIndex}.photos`) || []).map((photoSrc, photoIndex) => (
                                                        <div key={photoIndex} className="relative">
                                                            <Image src={photoSrc} alt={`Zdjęcie ${photoIndex + 1}`} width={80} height={80} className="rounded-md object-cover h-20 w-20" />
                                                            <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => removePhoto(categoryIndex, photoIndex)}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </FormItem>
                                        </div>
                                    </ScrollArea>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => activeCategoryIndex !== null && handleFileChange(e, activeCategoryIndex)} 
                    />
                </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
              <Button type="submit">Zapisz inspekcję</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const InspectionActions = ({ item, onEdit, onDelete }: { item: Inspection; onEdit: (item: Inspection) => void; onDelete: (id: string) => void; }) => {
    return (
        <AlertDialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Otwórz menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(item)}>Edytuj</DropdownMenuItem>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Czy na pewno chcesz usunąć tę inspekcję?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tej operacji nie można cofnąć. Spowoduje to trwałe usunięcie raportu z dnia <span className="font-bold">{format(new Date(item.date), 'dd-MM-yyyy')}</span> dla adresu <span className="font-bold">{item.addressName}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDelete(item.id)}>Usuń</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const InspectionsTable = ({ inspections, onEdit, onDelete }: { inspections: Inspection[]; onEdit: (item: Inspection) => void; onDelete: (id: string) => void; }) => {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Adres</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Koordynator</TableHead>
                        <TableHead>Standard</TableHead>
                        <TableHead><span className="sr-only">Akcje</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {inspections.length > 0 ? (
                        inspections.map(item => (
                            <TableRow key={item.id} onClick={() => onEdit(item)} className="cursor-pointer">
                                <TableCell>{item.addressName}</TableCell>
                                <TableCell>{format(new Date(item.date), 'dd-MM-yyyy')}</TableCell>
                                <TableCell>{item.coordinatorName}</TableCell>
                                <TableCell>{item.standard}</TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <InspectionActions item={item} onEdit={onEdit} onDelete={onDelete} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                Brak inspekcji do wyświetlenia.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

const InspectionsCardList = ({ inspections, onEdit, onDelete }: { inspections: Inspection[]; onEdit: (item: Inspection) => void; onDelete: (id: string) => void; }) => {
    return (
        <div className="space-y-4">
            {inspections.length > 0 ? (
                inspections.map(item => (
                    <Card key={item.id} onClick={() => onEdit(item)} className="cursor-pointer">
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                            <div>
                                <CardTitle className="text-base">{item.addressName}</CardTitle>
                                <CardDescription>{format(new Date(item.date), 'dd MMMM yyyy', { locale: pl })}</CardDescription>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                                <InspectionActions item={item} onEdit={onEdit} onDelete={onDelete} />
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                             <p><span className="font-semibold text-muted-foreground">Koordynator:</span> {item.coordinatorName}</p>
                             <p><span className="font-semibold text-muted-foreground">Standard:</span> {item.standard || 'Nieoceniony'}</p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                 <div className="text-center text-muted-foreground py-8">Brak inspekcji do wyświetlenia.</div>
            )}
        </div>
    );
}

export default function InspectionsView({ currentUser }: { currentUser: SessionData }) {
    const { allInspections, settings, handleAddInspection, handleUpdateInspection, handleDeleteInspection } = useMainLayout();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Inspection | null>(null);
    const { isMobile, isMounted } = useIsMobile();

    const handleSave = (data: Omit<Inspection, 'id' | 'addressName' | 'coordinatorName'>, id?: string) => {
        if (!currentUser || !settings) return;
        const addressName = settings.addresses.find(a => a.id === data.addressId)?.name || 'Nieznany';
        const coordinatorName = settings.coordinators.find(c => c.uid === data.coordinatorId)?.name || 'Nieznany';
        const inspectionData = { ...data, addressName, coordinatorName };

        if (id) {
            handleUpdateInspection(id, inspectionData);
        } else {
            handleAddInspection(inspectionData);
        }
        setIsFormOpen(false);
        setEditingItem(null);
    };

    const handleAddNew = () => {
        setEditingItem(null);
        setIsFormOpen(true);
    };

    const handleEdit = (item: Inspection) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };


    if (!allInspections || !settings) {
         return (
            <Card>
                <CardHeader>
                     <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                     <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const InspectionsListComponent = isMobile ? InspectionsCardList : InspectionsTable;

    return (
        <>
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Inspekcje</CardTitle>
                    <CardDescription>Przeglądaj, dodawaj i edytuj raporty z inspekcji.</CardDescription>
                </div>
                <Button onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nowa inspekcja
                </Button>
            </CardHeader>
            <CardContent>
                {isMounted ? (
                     <InspectionsListComponent inspections={allInspections} onEdit={handleEdit} onDelete={handleDeleteInspection} />
                ) : (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                )}
            </CardContent>
        </Card>
         {settings && currentUser && (
            <InspectionForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSave={handleSave}
                settings={settings}
                currentUser={currentUser}
                item={editingItem}
            />
        )}
        </>
    );
}
