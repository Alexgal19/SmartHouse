
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch, UseFieldArrayAppend, UseFieldArrayRemove } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMainLayout } from '@/components/main-layout';
import type { Settings, SessionData, Address, Coordinator } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle, Download, Loader2, FileWarning, Edit, Upload } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateAccommodationReport, transferEmployees } from '@/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { getOnlySettings } from '@/lib/sheets';

const coordinatorSchema = z.object({
    uid: z.string(),
    name: z.string().min(1, 'Imię jest wymagane.'),
    password: z.string().optional(),
    isAdmin: z.boolean(),
    departments: z.array(z.string()),
});

const formSchema = z.object({
  nationalities: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  departments: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  genders: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  localities: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  addresses: z.array(z.any()), // Simplified for top-level form, validation will be in the dialog
  coordinators: z.array(coordinatorSchema),
});

const AddMultipleDialog = ({ open, onOpenChange, onAdd, listTitle }: { open: boolean; onOpenChange: (open: boolean) => void; onAdd: (items: string[]) => void; listTitle: string; }) => {
    const [text, setText] = useState('');

    const handleAdd = () => {
        const items = text.split('\n').map(item => item.trim()).filter(item => item.length > 0);
        if (items.length > 0) {
            onAdd(items);
        }
        setText('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Dodaj wiele do: {listTitle}</DialogTitle>
                    <DialogDescription>
                        Wklej lub wpisz listę elementów, każdy w nowej linii.
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    placeholder="Element 1\nElement 2\nElement 3"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="h-48"
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
                    <Button onClick={handleAdd}>Dodaj z listy</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const ListManager = ({ name, title, fields, append, remove, control }: { name: string; title: string; fields: Record<"id", string>[]; append: (obj: { value: string} | {value: string}[]) => void; remove: (index: number) => void; control: any }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddMultipleOpen, setIsAddMultipleOpen] = useState(false);
    const watchedValues = useWatch({ control, name });

    const filteredFields = useMemo(() => {
        if (!searchTerm) return fields.map((field, index) => ({ ...field, originalIndex: index }));
        
        return fields
            .map((field, index) => ({ ...field, originalIndex: index, value: watchedValues[index]?.value }))
            .filter(field => field.value?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [fields, watchedValues, searchTerm]);

    const handleAddMultiple = (items: string[]) => {
        const newItems = items.map(item => ({ value: item }));
        append(newItems);
    };


    return (
        <div className="space-y-2 rounded-md border p-4">
            <h3 className="font-medium">{title}</h3>
            <div className="flex justify-between items-center mb-4 gap-2">
                 <Input 
                    placeholder="Szukaj..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddMultipleOpen(true)} className="shrink-0">
                    <PlusCircle className="mr-2 h-4 w-4" /> Dodaj
                </Button>
            </div>
            {filteredFields.map((field) => (
                <FormField
                    key={field.id}
                    name={`${name}.${field.originalIndex}.value`}
                    render={({ field: formField }) => (
                        <FormItem className="flex items-center gap-2">
                            <FormControl>
                                <Input {...formField} />
                            </FormControl>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(field.originalIndex)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </FormItem>
                    )}
                />
            ))}
            {filteredFields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Brak pozycji pasujących do wyszukiwania.</p>}
             <AddMultipleDialog 
                open={isAddMultipleOpen}
                onOpenChange={setIsAddMultipleOpen}
                onAdd={handleAddMultiple}
                listTitle={title}
            />
        </div>
    );
};

const CoordinatorManager = ({ form, fields, append, remove, departments }: { form:  ReturnType<typeof useForm<z.infer<typeof formSchema>>>; fields: Record<"id", string>[], append: UseFieldArrayAppend<z.infer<typeof formSchema>, "coordinators">, remove: UseFieldArrayRemove, departments: string[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const watchedCoordinators = useWatch({ control: form.control, name: 'coordinators' });

    const filteredFields = useMemo(() => {
        if (!searchTerm) return fields.map((field, index) => ({ ...field, originalIndex: index }));

        return fields
            .map((field, index) => ({ ...field, originalIndex: index, name: watchedCoordinators[index]?.name }))
            .filter(field => field.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [fields, watchedCoordinators, searchTerm]);


    return (
        <div className="space-y-4 rounded-md border p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                 <h3 className="font-medium">Koordynatorzy</h3>
                 <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">
                    <Input 
                        placeholder="Szukaj koordynatora..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-64 h-9"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ uid: `coord-${Date.now()}`, name: '', password: '', isAdmin: false, departments: [] })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj koordynatora
                    </Button>
                </div>
            </div>

            <Accordion type="multiple" className="w-full space-y-2">
                {filteredFields.map((field) => (
                    <AccordionItem value={field.id} key={field.id} className="border rounded-md px-4">
                        <AccordionTrigger>
                            <div className="flex items-center justify-between w-full pr-4">
                                <span className="font-semibold">{form.getValues(`coordinators.${field.originalIndex}.name`) || `Nowy koordynator`}</span>
                                <span className="text-sm text-muted-foreground">{form.getValues(`coordinators.${field.originalIndex}.isAdmin`) ? 'Admin' : 'Koordynator'}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="space-y-4 pt-2">
                                <FormField
                                    control={form.control}
                                    name={`coordinators.${field.originalIndex}.name`}
                                    render={({ field: nameField }) => (
                                        <FormItem>
                                        <FormLabel>Imię</FormLabel>
                                        <FormControl><Input {...nameField} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`coordinators.${field.originalIndex}.password`}
                                    render={({ field: passField }) => (
                                        <FormItem>
                                        <FormLabel>Hasło (pozostaw puste, aby nie zmieniać)</FormLabel>
                                        <FormControl><Input type="password" {...passField} placeholder="Nowe hasło" /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`coordinators.${field.originalIndex}.departments`}
                                    render={() => (
                                        <FormItem>
                                            <FormLabel>Zakłady</FormLabel>
                                            <div className="space-y-2">
                                                {(form.getValues(`coordinators.${field.originalIndex}.departments`) || []).map((dept, deptIndex) => (
                                                     <div key={deptIndex} className="flex items-center gap-2">
                                                         <FormField
                                                             control={form.control}
                                                             name={`coordinators.${field.originalIndex}.departments.${deptIndex}`}
                                                             render={({ field: deptField }) => (
                                                                <FormItem className="flex-1">
                                                                     <Select onValueChange={deptField.onChange} value={deptField.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Wybierz zakład" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )}
                                                        />
                                                         <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => {
                                                                const currentDepts = form.getValues(`coordinators.${field.originalIndex}.departments`);
                                                                form.setValue(`coordinators.${field.originalIndex}.departments`, currentDepts.filter((_, i) => i !== deptIndex));
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                     </div>
                                                ))}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => {
                                                        const currentDepts = form.getValues(`coordinators.${field.originalIndex}.departments`);
                                                        form.setValue(`coordinators.${field.originalIndex}.departments`, [...currentDepts, '']);
                                                    }}
                                                >
                                                    <PlusCircle className="h-4 w-4 mr-2"/>
                                                    Dodaj zakład
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex justify-between items-center">
                                    <FormField
                                        control={form.control}
                                        name={`coordinators.${field.originalIndex}.isAdmin`}
                                        render={({ field: adminField }) => (
                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                <FormControl>
                                                     <Switch checked={adminField.value} onCheckedChange={adminField.onChange} />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    Uprawnienia administratora
                                                </FormLabel>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <Button type="button" variant="ghost" size="icon" onClick={() => remove(field.originalIndex)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            {filteredFields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Brak koordynatorów pasujących do wyszukiwania.</p>}
        </div>
    );
};

const AddressManager = ({ addresses, coordinators, localities, onEdit, onRemove, onAdd }: { addresses: Address[]; coordinators: Coordinator[]; localities: string[]; onEdit: (address: Address) => void; onRemove: (addressId: string) => void; onAdd: (coordinatorId: string) => void; }) => {
    const [filterCoordinatorId, setFilterCoordinatorId] = useState('all');
    const [filterLocality, setFilterLocality] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    const coordinatorMap = useMemo(() => new Map(coordinators.map(c => [c.uid, c.name])), [coordinators]);
    const sortedCoordinators = useMemo(() => [...coordinators].sort((a,b) => a.name.localeCompare(b.name)), [coordinators]);
    const sortedLocalities = useMemo(() => [...localities].sort((a, b) => a.localeCompare(b)), [localities]);

    const filteredAddresses = useMemo(() => {
        if (!addresses) return [];
        let tempAddresses = addresses;

        if (filterCoordinatorId !== 'all') {
            tempAddresses = tempAddresses.filter(a => a.coordinatorIds.includes(filterCoordinatorId));
        }
        if (filterLocality !== 'all') {
            tempAddresses = tempAddresses.filter(a => a.locality === filterLocality);
        }
        if (searchTerm) {
            tempAddresses = tempAddresses.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        
        return tempAddresses.sort((a, b) => a.name.localeCompare(b.name));

    }, [addresses, filterCoordinatorId, filterLocality, searchTerm]);

    return (
        <div className="space-y-4 rounded-md border p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="font-medium">Adresy i pokoje</h3>
                 <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">
                    <Input 
                        placeholder="Szukaj adresu..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-9 w-full sm:w-48"
                    />
                    <Select value={filterLocality} onValueChange={setFilterLocality}>
                        <SelectTrigger className="w-full sm:w-[180px] h-9">
                            <SelectValue placeholder="Filtruj wg miejscowości" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie miejscowości</SelectItem>
                            {sortedLocalities.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filterCoordinatorId} onValueChange={setFilterCoordinatorId}>
                        <SelectTrigger className="w-full sm:w-[200px] h-9">
                            <SelectValue placeholder="Filtruj wg koordynatora" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszyscy koordynatorzy</SelectItem>
                            {sortedCoordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdd(filterCoordinatorId)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj
                    </Button>
                 </div>
            </div>
            {filteredAddresses && filteredAddresses.length > 0 ? (
                <div className="space-y-2">
                    {filteredAddresses.map((address: Address) => (
                        <div key={address.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="font-semibold">{address.name} <span className="text-sm text-muted-foreground font-normal">({address.locality})</span></p>
                                <p className="text-sm text-muted-foreground">
                                    {address.coordinatorIds.map(id => coordinatorMap.get(id) || 'B/D').join(', ')}, {address.rooms.length} pokoi
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(address)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(address.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Brak adresów pasujących do kryteriów.</p>
            )}
        </div>
    );
};


const BulkActions = ({ currentUser }: { currentUser: SessionData }) => {
    const { handleBulkDeleteEmployees, handleBulkDeleteEmployeesByCoordinator, rawSettings } = useMainLayout();
    const [isDeletingActive, setIsDeletingActive] = useState(false);
    const [isDeletingDismissed, setIsDeletingDismissed] = useState(false);
    const [isDeletingByCoord, setIsDeletingByCoord] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    
    const [transferFrom, setTransferFrom] = useState('');
    const [transferTo, setTransferTo] = useState('');
    const [deleteCoordinatorId, setDeleteCoordinatorId] = useState('');

    const { toast } = useToast();
    
    const sortedCoordinators = useMemo(() => {
      if (!rawSettings?.coordinators) return [];
      return [...rawSettings.coordinators].sort((a,b) => a.name.localeCompare(b.name));
    }, [rawSettings?.coordinators]);

    const handleBulkDelete = async (status: 'active' | 'dismissed') => {
        if(status === 'active') setIsDeletingActive(true);
        else setIsDeletingDismissed(true);

        const success = await handleBulkDeleteEmployees('employee', status);
        
        if(status === 'active') setIsDeletingActive(false);
        else setIsDeletingDismissed(false);
        return success
    };

    const handleCoordinatorDelete = async () => {
        if (!deleteCoordinatorId) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Wybierz koordynatora.' });
            return;
        }
        setIsDeletingByCoord(true);
        const success = await handleBulkDeleteEmployeesByCoordinator(deleteCoordinatorId);
        if (success) {
            setDeleteCoordinatorId('');
        }
        setIsDeletingByCoord(false);
    };
    
    const handleTransfer = async () => {
        if (!transferFrom || !transferTo) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Wybierz obu koordynatorów.' });
            return;
        }
        if (transferFrom === transferTo) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Nie można przenieść pracowników do tego samego koordynatora.' });
            return;
        }
        setIsTransferring(true);
        try {
            await transferEmployees(transferFrom, transferTo);
            toast({ title: "Sukces", description: "Pracownicy zostali przeniesieni." });
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się przenieść pracowników." });
        } finally {
            setIsTransferring(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Akcje masowe</CardTitle>
                <CardDescription>Zarządzaj danymi pracowników hurtowo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start justify-between rounded-lg border border-destructive/50 bg-destructive/10 p-4 gap-4">
                    <div className="flex-1">
                        <h3 className="font-medium text-destructive">Masowe usuwanie</h3>
                        <p className="text-sm text-destructive/80">Te akcje są nieodwracalne.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeletingActive} className="w-full">
                                    {isDeletingActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Usuń wszystkich aktywnych
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Czy na pewno chcesz usunąć WSZYSTKICH aktywnych pracowników?</AlertDialogTitle>
                                    <AlertDialogDescription>Ta operacja jest nieodwracalna. Wszyscy pracownicy ze statusem &quot;aktywny&quot; zostaną trwale usunięci.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleBulkDelete('active')}>Potwierdź i usuń</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeletingDismissed} className="w-full">
                                     {isDeletingDismissed ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Usuń wszystkich zwolnionych
                                </Button>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Czy na pewno chcesz usunąć WSZYSTKICH zwolnionych pracowników?</AlertDialogTitle>
                                    <AlertDialogDescription>Ta operacja jest nieodwracalna. Wszyscy pracownicy ze statusem &quot;zwolniony&quot; zostaną trwale usunięci.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleBulkDelete('dismissed')}>Potwierdź i usuń</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                 </div>

                 {currentUser.isAdmin && rawSettings?.coordinators && (
                     <div className="rounded-lg border p-4 space-y-4">
                         <div className="flex-1">
                            <h3 className="font-medium">Przenoszenie pracowników</h3>
                            <p className="text-sm text-muted-foreground">Przenieś wszystkich pracowników od jednego koordynatora do drugiego.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Od koordynatora</Label>
                                <Select value={transferFrom} onValueChange={setTransferFrom}>
                                    <SelectTrigger><SelectValue placeholder="Wybierz koordynatora" /></SelectTrigger>
                                    <SelectContent>
                                        {sortedCoordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Do koordynatora</Label>
                                <Select value={transferTo} onValueChange={setTransferTo}>
                                    <SelectTrigger><SelectValue placeholder="Wybierz koordynatora" /></SelectTrigger>
                                    <SelectContent>
                                        {sortedCoordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleTransfer} disabled={isTransferring}>
                                {isTransferring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Przenieś
                            </Button>
                        </div>
                     </div>
                 )}
                 {currentUser.isAdmin && rawSettings?.coordinators && (
                     <div className="rounded-lg border p-4 space-y-4 border-destructive/50 bg-destructive/10">
                         <div className="flex-1">
                            <h3 className="font-medium text-destructive">Usuwanie pracowników koordynatora</h3>
                            <p className="text-sm text-destructive/80">Trwale usuwa wszystkich pracowników (aktywnych i zwolnionych) przypisanych do wybranego koordynatora. Ta akcja jest nieodwracalna.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Koordynator</Label>
                                <Select value={deleteCoordinatorId} onValueChange={setDeleteCoordinatorId}>
                                    <SelectTrigger><SelectValue placeholder="Wybierz koordynatora" /></SelectTrigger>
                                    <SelectContent>
                                        {sortedCoordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isDeletingByCoord || !deleteCoordinatorId}>
                                        {isDeletingByCoord ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Usuń pracowników
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Czy na pewno chcesz usunąć WSZYSTKICH pracowników tego koordynatora?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Ta operacja jest nieodwracalna. Wszyscy pracownicy przypisani do <span className="font-bold">{sortedCoordinators.find(c=>c.uid === deleteCoordinatorId)?.name}</span> zostaną trwale usunięci.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleCoordinatorDelete}>Potwierdź i usuń</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                     </div>
                 )}
            </CardContent>
        </Card>
    );
}

const ReportsGenerator = ({ rawSettings, currentUser }: { rawSettings: Settings; currentUser: SessionData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [coordinatorId, setCoordinatorId] = useState<string>(currentUser.isAdmin ? 'all' : currentUser.uid);
    const { toast } = useToast();
    
    const sortedCoordinators = useMemo(() => {
      if (!rawSettings?.coordinators) return [];
      return [...rawSettings.coordinators].sort((a,b) => a.name.localeCompare(b.name));
    }, [rawSettings?.coordinators]);

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const result = await generateAccommodationReport(year, month, coordinatorId);
            
            if (result.success && result.fileContent) {
                const link = document.createElement("a");
                link.href = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + result.fileContent;
                link.download = result.fileName || 'raport.xlsx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: "Sukces", description: "Raport został wygenerowany." });
            } else {
                throw new Error(result.message || 'Nie udało się wygenerować raportu.');
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Wystąpił nieznany błąd." });
        } finally {
            setIsLoading(false);
        }
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (value, i) => i + 1);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generowanie raportu zakwaterowania</CardTitle>
                <CardDescription>Wygeneruj szczegółowy raport w formacie XLSX.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
                     <div className="space-y-2">
                         <Label>Rok</Label>
                        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                         <Label>Miesiąc</Label>
                        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                     </div>
                    {currentUser.isAdmin && (
                        <div className="space-y-2">
                            <Label>Koordynator</Label>
                            <Select value={coordinatorId} onValueChange={setCoordinatorId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Wszyscy koordynatorzy</SelectItem>
                                    {sortedCoordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        <span className="ml-2">Generuj</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

const ExcelImport = () => {
    const { handleImportEmployees } = useMainLayout();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            await handleImportEmployees(file);
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Błąd importu',
                description: e instanceof Error ? e.message : 'Nie udało się przetworzyć pliku.',
            });
        } finally {
            setIsLoading(false);
            if(fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    
    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Import z Excel</CardTitle>
                <CardDescription>Zaimportuj nowych pracowników z pliku XLSX.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                />
                <Button onClick={handleButtonClick} disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="mr-2 h-4 w-4" />
                    )}
                    Wybierz plik i importuj
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                    Upewnij się, że plik ma kolumny: Imię i nazwisko, Koordynator, Narodowość, Płeć, Adres, Pokój, Zakład, Data zameldowania, etc.
                </p>
            </CardContent>
        </Card>
    )
}

function SettingsManager({ rawSettings, form, handleUpdateSettings, handleAddressFormOpen }: { rawSettings: Settings, form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>; handleUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>, handleAddressFormOpen: (address: Address | null) => void }) {
    const { fields: natFields, append: appendNat, remove: removeNat } = useFieldArray({ control: form.control, name: 'nationalities' });
    const { fields: depFields, append: appendDep, remove: removeDep } = useFieldArray({ control: form.control, name: 'departments' });
    const { fields: genFields, append: appendGen, remove: removeGen } = useFieldArray({ control: form.control, name: 'genders' });
    const { fields: locFields, append: appendLoc, remove: removeLoc } = useFieldArray({ control: form.control, name: 'localities' });
    const { fields: coordFields, append: appendCoord, remove: removeCoord } = useFieldArray({ control: form.control, name: 'coordinators' });
    const { remove: removeAddr } = useFieldArray({ control: form.control, name: 'addresses' });

    const watchedAddresses = useWatch({ control: form.control, name: 'addresses' });
    const watchedCoordinators = useWatch({ control: form.control, name: 'coordinators' });
    const watchedLocalities = useWatch({ control: form.control, name: 'localities' });
    const watchedDepartments = useWatch({ control: form.control, name: 'departments' });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        const newSettings: Partial<Settings> = {
            nationalities: values.nationalities.map((n) => n.value).sort((a, b) => a.localeCompare(b)),
            departments: values.departments.map((d) => d.value).sort((a, b) => a.localeCompare(b)),
            genders: values.genders.map((d) => d.value).sort((a, b) => a.localeCompare(b)),
            localities: values.localities.map((l) => l.value).sort((a, b) => a.localeCompare(b)),
            addresses: values.addresses,
            coordinators: values.coordinators.sort((a,b) => a.name.localeCompare(b.name)),
        };
        await handleUpdateSettings(newSettings);
        form.reset(values); // Resets the dirty state
    };

    const handleRemoveAddress = (addressId: string) => {
        const addresses = form.getValues('addresses');
        const addressIndex = addresses.findIndex((a: Address) => a.id === addressId);
        if (addressIndex > -1) {
            removeAddr(addressIndex);
        }
    }

    const handleAddAddress = (coordinatorId: string) => {
        const newAddress: Address = {
            id: `addr-${Date.now()}`,
            name: '',
            locality: '',
            coordinatorIds: coordinatorId === 'all' ? [] : [coordinatorId],
            rooms: [],
        };
        handleAddressFormOpen(newAddress);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ustawienia aplikacji</CardTitle>
                <CardDescription>Zarządzaj globalnymi ustawieniami aplikacji, takimi jak listy, adresy i koordynatorzy.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="lists">
                                <AccordionTrigger>Zarządzanie listami</AccordionTrigger>
                                <AccordionContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2">
                                    <ListManager name="nationalities" title="Narodowości" fields={natFields} append={appendNat} remove={removeNat} control={form.control} />
                                    <ListManager name="departments" title="Zakłady" fields={depFields} append={appendDep} remove={removeDep} control={form.control} />
                                    <ListManager name="genders" title="Płcie" fields={genFields} append={appendGen} remove={removeGen} control={form.control} />
                                    <ListManager name="localities" title="Miejscowości" fields={locFields} append={appendLoc} remove={removeLoc} control={form.control} />
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="coordinators">
                                <AccordionTrigger>Zarządzanie koordynatorami</AccordionTrigger>
                                <AccordionContent className="p-2">
                                    <CoordinatorManager form={form} fields={coordFields} append={appendCoord} remove={removeCoord} departments={(watchedDepartments || []).map((d: { value: string}) => d.value)} />
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="addresses">
                                <AccordionTrigger>Zarządzanie adresami</AccordionTrigger>
                                <AccordionContent className="p-2">
                                    <AddressManager 
                                        addresses={watchedAddresses || []}
                                        coordinators={watchedCoordinators || []}
                                        localities={(watchedLocalities || []).map((l: { value: string; }) => l.value)}
                                        onEdit={(address) => handleAddressFormOpen(address)}
                                        onAdd={handleAddAddress}
                                        onRemove={handleRemoveAddress}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Zapisz zmiany
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

export default function SettingsView({ currentUser }: { currentUser: SessionData }) {
    const { handleUpdateSettings, handleAddressFormOpen } = useMainLayout();
    const [rawSettings, setRawSettings] = useState<Settings | null>(null);
  
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
    });

    useEffect(() => {
        const fetchRawSettings = async () => {
             if (currentUser.isAdmin) {
                try {
                    const settings = await getOnlySettings();
                    setRawSettings(settings);
                } catch(e) {
                    console.error("Failed to load settings", e);
                }
             }
        }
        fetchRawSettings();
    }, [currentUser]);

    useEffect(() => {
        if (rawSettings) {
        form.reset({
            nationalities: rawSettings.nationalities.map(n => ({ value: n })).sort((a,b) => a.value.localeCompare(b.value)),
            departments: rawSettings.departments.map(d => ({ value: d })).sort((a,b) => a.value.localeCompare(b.value)),
            genders: rawSettings.genders.map(g => ({ value: g })).sort((a,b) => a.value.localeCompare(b.value)),
            localities: rawSettings.localities.map(l => ({ value: l })).sort((a,b) => a.value.localeCompare(b.value)),
            addresses: [...rawSettings.addresses].sort((a, b) => a.name.localeCompare(b.name)),
            coordinators: [...rawSettings.coordinators].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({...c, password: ''})),
        });
        }
    }, [rawSettings, form]);
  
  if (!currentUser.isAdmin) {
      return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center text-destructive"><FileWarning className="mr-2"/>Brak uprawnień</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Nie masz uprawnień do przeglądania tej strony.</p>
            </CardContent>
        </Card>
      )
  }

  if (!rawSettings) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                    <CardContent><div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div></CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                    <CardContent><Skeleton className="h-32 w-full" /></CardContent>
                </Card>
            </div>
        );
  }

  return (
    <div className="space-y-6">
      <SettingsManager rawSettings={rawSettings} form={form} handleUpdateSettings={handleUpdateSettings} handleAddressFormOpen={handleAddressFormOpen} />
      <ExcelImport />
      <ReportsGenerator rawSettings={rawSettings} currentUser={currentUser} />
      <BulkActions currentUser={currentUser} />
    </div>
  );
}

