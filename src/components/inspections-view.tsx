"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMainLayout } from '@/components/main-layout';
import type { Inspection, Settings, SessionData, InspectionCategory, InspectionCategoryItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const inspectionItemSchema = z.object({
  label: z.string(),
  value: z.any(),
  type: z.enum(['text', 'number', 'select', 'yes_no', 'rating', 'checkbox_group']),
  options: z.array(z.string()).optional(),
});

const inspectionCategorySchema = z.object({
  name: z.string(),
  items: z.array(inspectionItemSchema),
  uwagi: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

const formSchema = z.object({
  addressId: z.string().min(1, "Adres jest wymagany."),
  date: z.date({ required_error: "Data inspekcji jest wymagana." }),
  standard: z.enum(['Wysoki', 'Normalny', 'Niski']).nullable(),
  categories: z.array(inspectionCategorySchema),
});

const renderValue = (item: InspectionCategoryItem) => {
    if (item.type === 'yes_no') {
        return item.value ? 'Tak' : 'Nie';
    }
    if (item.type === 'checkbox_group' && Array.isArray(item.value)) {
        return item.value.join(', ');
    }
    return String(item.value);
};

const InspectionForm = ({ isOpen, onOpenChange, settings, currentUser, onSave }: { isOpen: boolean; onOpenChange: (open: boolean) => void; settings: Settings; currentUser: SessionData; onSave: (data: Omit<Inspection, 'id'>) => void; }) => {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            addressId: '',
            date: new Date(),
            standard: null,
            categories: settings.inspectionTemplate || []
        },
    });

    const { fields } = useFieldArray({ control: form.control, name: "categories" });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        const address = settings.addresses.find(a => a.id === values.addressId);
        if (!address) return;

        const inspectionData = {
            ...values,
            date: format(values.date, 'yyyy-MM-dd'),
            addressName: address.name,
            coordinatorId: currentUser.uid,
            coordinatorName: currentUser.name,
        };
        onSave(inspectionData);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl flex flex-col h-screen sm:h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Nowa inspekcja</DialogTitle>
                    <DialogDescription>Wypełnij formularz, aby dodać nową inspekcję.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-1">
                             <FormField
                                control={form.control}
                                name="addressId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adres</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Wybierz adres" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {settings.addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
                                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? format(field.value, "PPP") : <span>Wybierz datę</span>}
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
                             <FormField
                                control={form.control}
                                name="standard"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Standard</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Wybierz standard" /></SelectTrigger></FormControl>
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
                        </div>

                        <ScrollArea className="flex-1 mt-4 -mr-6 pr-6">
                            <div className="space-y-6 p-1">
                                {fields.map((category, categoryIndex) => (
                                    <Card key={category.id}>
                                        <CardHeader><CardTitle className="text-lg">{category.name}</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            {category.items.map((item, itemIndex) => {
                                                const fieldName = `categories.${categoryIndex}.items.${itemIndex}.value` as const;
                                                return (
                                                    <FormItem key={`${category.id}-${itemIndex}`}>
                                                        <FormLabel>{item.label}</FormLabel>
                                                        <FormControl>
                                                             <Controller
                                                                control={form.control}
                                                                name={fieldName}
                                                                render={({ field }) => {
                                                                    switch (item.type) {
                                                                        case 'yes_no':
                                                                            return (
                                                                                <RadioGroup onValueChange={(val) => field.onChange(val === 'true')} defaultValue={String(field.value)} className="flex gap-4">
                                                                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="true" /></FormControl><FormLabel className="font-normal">Tak</FormLabel></FormItem>
                                                                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="false" /></FormControl><FormLabel className="font-normal">Nie</FormLabel></FormItem>
                                                                                </RadioGroup>
                                                                            );
                                                                        case 'select':
                                                                            return (
                                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                                    <FormControl><SelectTrigger><SelectValue placeholder="..." /></SelectTrigger></FormControl>
                                                                                    <SelectContent>{item.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                                                                </Select>
                                                                            );
                                                                        case 'checkbox_group':
                                                                            return (
                                                                                <div className="space-y-2">
                                                                                    {item.options?.map(opt => (
                                                                                        <FormItem key={opt} className="flex flex-row items-start space-x-3 space-y-0">
                                                                                            <FormControl>
                                                                                                <Checkbox
                                                                                                    checked={field.value?.includes(opt)}
                                                                                                    onCheckedChange={(checked) => {
                                                                                                        return checked
                                                                                                            ? field.onChange([...(field.value || []), opt])
                                                                                                            : field.onChange((field.value || []).filter((v: string) => v !== opt));
                                                                                                    }}
                                                                                                />
                                                                                            </FormControl>
                                                                                            <FormLabel className="font-normal">{opt}</FormLabel>
                                                                                        </FormItem>
                                                                                    ))}
                                                                                </div>
                                                                            );
                                                                        default:
                                                                            return <Input type={item.type} {...field} />;
                                                                    }
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )
                                            })}
                                            <FormField control={form.control} name={`categories.${categoryIndex}.uwagi`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Uwagi</FormLabel>
                                                    <FormControl><Textarea {...field} /></FormControl>
                                                </FormItem>
                                            )}/>
                                        </CardContent>
                                    </Card>
                                ))}
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
}

const InspectionDetailDialog = ({ inspection, isOpen, onOpenChange }: { inspection: Inspection | null; isOpen: boolean; onOpenChange: (open: boolean) => void; }) => {
    if (!inspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl flex flex-col h-screen sm:h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Szczegóły inspekcji</DialogTitle>
                    <DialogDescription>{inspection.addressName} - {format(new Date(inspection.date), 'PPP')}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 -mr-6 pr-6">
                    <div className="space-y-4 py-4">
                        {inspection.categories.map((category, i) => (
                            <Card key={i}>
                                <CardHeader><CardTitle className="text-base">{category.name}</CardTitle></CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm">
                                        {category.items.map((item, j) => (
                                            <li key={j} className="flex justify-between">
                                                <span>{item.label}:</span>
                                                <span className="font-semibold text-right">{renderValue(item)}</span>
                                            </li>
                                        ))}
                                        {category.uwagi && <li className="pt-2"><strong className="text-muted-foreground">Uwagi:</strong> {category.uwagi}</li>}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default function InspectionsView({ currentUser }: { currentUser: SessionData }) {
    const { allInspections, settings, handleAddInspection } = useMainLayout();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

    const inspections = useMemo(() => {
        if (!allInspections) return [];
        return allInspections.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allInspections]);

    if (!allInspections || !settings) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Inspekcje</CardTitle>
                        <CardDescription>Przeglądaj i dodawaj nowe inspekcje.</CardDescription>
                    </div>
                    <Button onClick={() => setIsFormOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj inspekcję
                    </Button>
                </CardHeader>
                <CardContent>
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
                                inspections.map(inspection => (
                                    <TableRow key={inspection.id} onClick={() => setSelectedInspection(inspection)} className="cursor-pointer">
                                        <TableCell className="font-medium">{inspection.addressName}</TableCell>
                                        <TableCell>{format(new Date(inspection.date), 'dd-MM-yyyy')}</TableCell>
                                        <TableCell>{inspection.coordinatorName}</TableCell>
                                        <TableCell>{inspection.standard || 'N/A'}</TableCell>
                                        <TableCell>
                                             <Button variant="ghost" size="icon" onClick={() => setSelectedInspection(inspection)}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Brak inspekcji.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <InspectionForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                settings={settings}
                currentUser={currentUser}
                onSave={handleAddInspection}
            />

            <InspectionDetailDialog
                inspection={selectedInspection}
                isOpen={!!selectedInspection}
                onOpenChange={(isOpen) => !isOpen && setSelectedInspection(null)}
            />
        </>
    );
}
