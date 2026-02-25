
"use client";

import { useState, useMemo, useEffect, useRef, ChangeEvent } from 'react';
import { useForm, useFieldArray, useWatch, UseFieldArrayAppend, UseFieldArrayRemove, Control, FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Settings, SessionData, Address, Coordinator } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle, Download, Loader2, FileWarning, Edit, Upload, Eye, EyeOff, DatabaseZap } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateAccommodationReport, transferEmployees, generateNzCostsReport } from '@/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AddressForm } from './address-form';
import { useMainLayout } from './main-layout';
import { Progress } from '@/components/ui/progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

const coordinatorSchema = z.object({
    uid: z.string(),
    name: z.string().min(1, 'Imię jest wymagane.'),
    password: z.string().optional(),
    isAdmin: z.boolean(),
    isDriver: z.boolean().optional(),
    departments: z.array(z.string()),
    visibilityMode: z.enum(['department', 'strict']).default('department'),
});

const formSchema = z.object({
    nationalities: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    departments: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    genders: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    localities: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    paymentTypesNZ: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    statuses: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    bokRoles: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    bokReturnOptions: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
    addresses: z.array(z.any()),
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


const ListManager = ({ name, title, fields, append, remove, control }: { name: FieldPath<z.infer<typeof formSchema>>; title: string; fields: Record<"id", string>[]; append: (obj: { value: string } | { value: string }[]) => void; remove: (index: number) => void; control: Control<z.infer<typeof formSchema>> }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddMultipleOpen, setIsAddMultipleOpen] = useState(false);
    const watchedValues = useWatch({ control, name }) as { value: string }[] | undefined;

    const filteredFields = useMemo(() => {
        if (!searchTerm) return fields.map((field, index) => ({ ...field, originalIndex: index }));

        return fields
            .map((field, index) => ({ ...field, originalIndex: index, value: watchedValues?.[index]?.value }))
            .filter(field => field.value?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [fields, watchedValues, searchTerm]);

    const handleAddMultiple = (items: string[]) => {
        const newItems = items.map(item => ({ value: item }));
        append(newItems);
    };


    return (
        <AccordionItem value={name} className="border rounded-md px-4">
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-2 pt-2">
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
                        listTitle={title}
                        onAdd={handleAddMultiple}
                    />
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const CoordinatorManager = ({ form, fields, append, remove, departments }: { form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>; fields: Record<"id", string>[], append: UseFieldArrayAppend<z.infer<typeof formSchema>, "coordinators">, remove: UseFieldArrayRemove, departments: string[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleFields, setVisibleFields] = useState<Record<string, { name: boolean, pass: boolean }>>({});
    const watchedCoordinators = useWatch({ control: form.control, name: 'coordinators' });

    const toggleVisibility = (id: string, field: 'name' | 'pass', _originalIndex: number) => {
        const isCurrentlyVisible = visibleFields[id]?.[field];

        setVisibleFields(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: !isCurrentlyVisible
            }
        }));
    };

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
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ uid: `coord-${Date.now()}`, name: '', password: '', isAdmin: false, isDriver: false, departments: [], visibilityMode: 'department' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj koordynatora
                    </Button>
                </div>
            </div>

            <Accordion type="multiple" className="w-full space-y-2">
                {filteredFields.map((field) => (
                    <AccordionItem value={field.id} key={field.id} className="border rounded-md px-4 animate-fade-in-up" style={{ animationDelay: `${field.originalIndex * 50}ms`, animationFillMode: 'backwards' }}>
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
                                            <FormLabel>Imię (Login)</FormLabel>
                                            <div className="relative">
                                                <FormControl>
                                                    <Input {...nameField} />
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`coordinators.${field.originalIndex}.password`}
                                    render={({ field: passField }) => (
                                        <FormItem>
                                            <FormLabel>Hasło</FormLabel>
                                            <div className="relative">
                                                <FormControl>
                                                    <Input
                                                        type={visibleFields[field.id]?.pass ? 'text' : 'password'}
                                                        {...passField}
                                                        placeholder="Kliknij oko, aby wyświetlić lub zmienić"
                                                    />
                                                </FormControl>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                                                    onClick={() => toggleVisibility(field.id, 'pass', field.originalIndex)}
                                                >
                                                    {visibleFields[field.id]?.pass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`coordinators.${field.originalIndex}.departments`}
                                    render={({ field: parentField }) => (
                                        <FormItem>
                                            <FormLabel>Zakłady</FormLabel>
                                            <div className="space-y-2">
                                                {(parentField.value || []).map((_dept, deptIndex) => (
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
                                                                            {departments.filter(Boolean).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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
                                                                const currentDepts = parentField.value || [];
                                                                parentField.onChange(currentDepts.filter((_: any, i: number) => i !== deptIndex));
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
                                                        const currentDepts = parentField.value || [];
                                                        parentField.onChange([...currentDepts, '']);
                                                    }}
                                                >
                                                    <PlusCircle className="h-4 w-4 mr-2" />
                                                    Dodaj zakład
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`coordinators.${field.originalIndex}.visibilityMode`}
                                    render={({ field: modeField }) => (
                                        <FormItem>
                                            <FormLabel>Tryb widoczności</FormLabel>
                                            <Select onValueChange={modeField.onChange} value={modeField.value || 'department'}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Wybierz tryb" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="department">Globalny (wg zakładów)</SelectItem>
                                                    <SelectItem value="strict">Ścisły (wg przypisania)</SelectItem>
                                                </SelectContent>
                                            </Select>
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

                                <FormField
                                    control={form.control}
                                    name={`coordinators.${field.originalIndex}.isDriver`}
                                    render={({ field: driverField }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                            <FormControl>
                                                <Switch checked={driverField.value || false} onCheckedChange={driverField.onChange} />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                                Uprawnienia kierowcy (Tylko dostęp do BOK)
                                            </FormLabel>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex justify-end pt-4 mt-4 border-t">
                                    <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
                                        {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Zapisz zmiany
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

type Occupant = { status: string; address?: string | null };

const AddressManager = ({ addresses, coordinators, localities, onEdit, onRemove, onAdd, allEmployees, allNonEmployees }: { addresses: Address[]; coordinators: Coordinator[]; localities: string[]; onEdit: (address: Address) => void; onRemove: (addressId: string) => void; onAdd: (coordinatorId: string) => void; allEmployees: Occupant[]; allNonEmployees: Occupant[] }) => {
    const [filterCoordinatorId, setFilterCoordinatorId] = useState('all');
    const [filterLocality, setFilterLocality] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const coordinatorMap = useMemo(() => new Map(coordinators.map(c => [c.uid, c.name])), [coordinators]);
    const sortedCoordinators = useMemo(() => [...coordinators].sort((a, b) => a.name.localeCompare(b.name)), [coordinators]);
    const sortedLocalities = useMemo(() => [...localities].sort((a, b) => a.localeCompare(b)), [localities]);

    const occupancyData = useMemo(() => {
        const occupancyMap = new Map<string, { occupants: number, capacity: number }>();
        const allOccupants = [...allEmployees, ...allNonEmployees].filter(o => o.status === 'active');

        allOccupants.forEach(occupant => {
            if (occupant.address) {
                const current = occupancyMap.get(occupant.address) || { occupants: 0, capacity: 0 };
                current.occupants += 1;
                occupancyMap.set(occupant.address, current);
            }
        });

        addresses.forEach(address => {
            const current = occupancyMap.get(address.name) || { occupants: 0, capacity: 0 };
            current.capacity = address.rooms.reduce((sum, room) => sum + room.capacity, 0);
            occupancyMap.set(address.name, current);
        });

        return occupancyMap;

    }, [addresses, allEmployees, allNonEmployees]);

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

    const getProgressColor = (value: number) => {
        if (value < 30) return 'hsl(0 84.2% 60.2%)'; // red
        if (value < 70) return 'hsl(var(--primary))'; // orange
        return 'hsl(142.1 76.2% 36.3%)'; // green
    };


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
                            {sortedLocalities.filter(Boolean).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
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
                    {filteredAddresses.map((address: Address, index: number) => {
                        const data = occupancyData.get(address.name) || { occupants: 0, capacity: 0 };
                        const occupancyPercentage = data.capacity > 0 ? (data.occupants / data.capacity) * 100 : 0;

                        return (
                            <div key={address.id} className="rounded-lg border p-3 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{address.name} <span className="text-sm text-muted-foreground font-normal">({address.locality})</span></p>
                                        <p className="text-sm text-muted-foreground">
                                            {address.coordinatorIds.map(id => coordinatorMap.get(id) || 'B/D').join(', ')}, {address.rooms.length} pokoi, {data.occupants}/{data.capacity} miejsc
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
                                <div className="flex items-center gap-2 mt-2">
                                    <Progress
                                        value={occupancyPercentage}
                                        className="h-2"
                                        indicatorStyle={{ backgroundColor: getProgressColor(occupancyPercentage) }}
                                    />
                                    <span className="text-xs font-semibold w-12 text-right">{occupancyPercentage.toFixed(0)}%</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Brak adresów pasujących do kryteriów.</p>
            )}
        </div>
    );
};

const DataMigration = () => {
    const { handleMigrateFullNames } = useMainLayout();
    const [isLoading, setIsLoading] = useState(false);

    const onMigrate = async () => {
        setIsLoading(true);
        await handleMigrateFullNames();
        setIsLoading(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migracja Danych</CardTitle>
                <CardDescription>Jednorazowe akcje do porządkowania danych w arkuszach.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                        <h3 className="font-medium">Migracja Imienia i Nazwiska</h3>
                        <p className="text-sm text-muted-foreground">
                            Przeszukuje arkusze i dzieli pole `fullName` na `firstName` i `lastName` dla starych rekordów.
                        </p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                                Uruchom migrację
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Czy na pewno chcesz uruchomić migrację?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Ta operacja przeanalizuje wszystkie rekordy pracowników i mieszkańców i uzupełni brakujące pola `firstName` i `lastName` na podstawie istniejącego pola `fullName`. Operacja jest bezpieczna, ale może potrwać chwilę.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                <AlertDialogAction onClick={onMigrate}>Uruchom</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}


const BulkActions = ({ currentUser, rawSettings }: { currentUser: SessionData; rawSettings: Settings | null }) => {
    const [isDeletingActive, setIsDeletingActive] = useState(false);
    const [isDeletingDismissed, setIsDeletingDismissed] = useState(false);
    const [isDeletingByCoord, setIsDeletingByCoord] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [isDeletingByDept, setIsDeletingByDept] = useState(false);

    const [transferFrom, setTransferFrom] = useState('');
    const [transferTo, setTransferTo] = useState('');
    const [deleteCoordinatorId, setDeleteCoordinatorId] = useState('');
    const [deleteDepartment, setDeleteDepartment] = useState('');

    const { toast } = useToast();
    const { handleBulkDeleteEmployeesByDepartment, handleBulkDeleteEmployees, handleBulkDeleteEmployeesByCoordinator, refreshData } = useMainLayout();

    const sortedCoordinators = useMemo(() => {
        if (!rawSettings?.coordinators) return [];
        return [...rawSettings.coordinators].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawSettings?.coordinators]);

    const sortedDepartments = useMemo(() => {
        if (!rawSettings?.departments) return [];
        return [...rawSettings.departments].sort((a, b) => a.localeCompare(b));
    }, [rawSettings?.departments]);

    const handleBulkDelete = async (status: 'active' | 'dismissed') => {
        if (!currentUser || !currentUser.isAdmin) {
            toast({ variant: "destructive", title: "Brak uprawnień", description: "Tylko administratorzy mogą wykonać tę akcję." });
            return;
        }

        if (status === 'active') setIsDeletingActive(true);
        else setIsDeletingDismissed(true);

        await handleBulkDeleteEmployees('employee', status);

        if (status === 'active') setIsDeletingActive(false);
        else setIsDeletingDismissed(false);
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

    const handleDepartmentDelete = async () => {
        if (!deleteDepartment) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Wybierz zakład.' });
            return;
        }
        setIsDeletingByDept(true);
        const success = await handleBulkDeleteEmployeesByDepartment(deleteDepartment);
        if (success) {
            setDeleteDepartment('');
        }
        setIsDeletingByDept(false);
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
            await refreshData(false);
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
                                    {isDeletingActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
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
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={async () => {
                                        try {
                                            await handleBulkDelete('active');
                                        } catch (e) {
                                            console.error('Bulk delete failed:', e);
                                        }
                                    }}>Potwierdź i usuń</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeletingDismissed} className="w-full">
                                    {isDeletingDismissed ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
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
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={async () => {
                                        try {
                                            await handleBulkDelete('dismissed');
                                        } catch (e) {
                                            console.error('Bulk delete failed:', e);
                                        }
                                    }}>Potwierdź i usuń</AlertDialogAction>
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
                                {isTransferring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                                        {isDeletingByCoord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Usuń pracowników
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Czy na pewno chcesz usunąć WSZYSTKICH pracowników tego koordynatora?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Ta operacja jest nieodwracalna. Wszyscy pracownicy przypisani do <span className="font-bold">{sortedCoordinators.find(c => c.uid === deleteCoordinatorId)?.name}</span> zostaną trwale usunięci.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={async () => {
                                            try {
                                                await handleCoordinatorDelete();
                                            } catch (e) {
                                                console.error('Coordinator delete failed:', e);
                                            }
                                        }}>Potwierdź i usuń</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                )}
                {currentUser.isAdmin && rawSettings?.departments && (
                    <div className="rounded-lg border p-4 space-y-4 border-destructive/50 bg-destructive/10">
                        <div className="flex-1">
                            <h3 className="font-medium text-destructive">Usuwanie pracowników wg zakładu</h3>
                            <p className="text-sm text-destructive/80">Trwale usuwa wszystkich pracowników (aktywnych i zwolnionych) przypisanych do wybranego zakładu. Ta akcja jest nieodwracalna.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Zakład</Label>
                                <Select value={deleteDepartment} onValueChange={setDeleteDepartment}>
                                    <SelectTrigger><SelectValue placeholder="Wybierz zakład" /></SelectTrigger>
                                    <SelectContent>
                                        {sortedDepartments.filter(Boolean).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isDeletingByDept || !deleteDepartment}>
                                        {isDeletingByDept ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Usuń pracowników
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Czy na pewno chcesz usunąć WSZYSTKICH pracowników z tego zakładu?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Ta operacja jest nieodwracalna. Wszyscy pracownicy przypisani do zakładu <span className="font-bold">{deleteDepartment}</span> zostaną trwale usunięci.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={async () => {
                                            try {
                                                await handleDepartmentDelete();
                                            } catch (e) {
                                                console.error('Department delete failed:', e);
                                            }
                                        }}>Potwierdź i usuń</AlertDialogAction>
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

const AccommodationReportGenerator = ({ rawSettings, currentUser }: { rawSettings: Settings; currentUser: SessionData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [coordinatorId, setCoordinatorId] = useState<string>(currentUser.isAdmin ? 'all' : currentUser.uid);
    const [includeAddressHistory, setIncludeAddressHistory] = useState(false);
    const { toast } = useToast();

    const sortedCoordinators = useMemo(() => {
        if (!rawSettings?.coordinators) return [];
        return [...rawSettings.coordinators].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawSettings?.coordinators]);

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const result = await generateAccommodationReport(year, month, coordinatorId, includeAddressHistory);

            if (result.success && result.fileContent) {
                const link = document.createElement("a");
                link.href = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + result.fileContent;
                link.download = result.fileName || 'raport.xlsx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: "Sukces", description: "Raport zakwaterowania został wygenerowany." });
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
                <CardTitle>Raport zakwaterowania</CardTitle>
                <CardDescription>Generuje raport XLSX pokazujący stan zakwaterowania w wybranym okresie.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
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
                            <span className="ml-2">Generuj raport</span>
                        </Button>
                    </div>
                    <div className="flex items-center space-x-2 pt-4">
                        <Switch id="include-history" checked={includeAddressHistory} onCheckedChange={setIncludeAddressHistory} />
                        <Label htmlFor="include-history">Uwzględnij historię zmian adresów w raporcie</Label>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const NzReportsGenerator = ({ rawSettings, currentUser }: { rawSettings: Settings; currentUser: SessionData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [coordinatorId, setCoordinatorId] = useState<string>(currentUser.isAdmin ? 'all' : currentUser.uid);
    const { toast } = useToast();

    const sortedCoordinators = useMemo(() => {
        if (!rawSettings?.coordinators) return [];
        return [...rawSettings.coordinators].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawSettings?.coordinators]);

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const result = await generateNzCostsReport(year, month, coordinatorId);

            if (result.success && result.fileContent) {
                const link = document.createElement("a");
                link.href = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + result.fileContent;
                link.download = result.fileName || 'raport_nz.xlsx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: "Sukces", description: "Raport kosztów (NZ) został wygenerowany." });
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
                <CardTitle>Generowanie raportu kosztów (NZ)</CardTitle>
                <CardDescription>Wygeneruj raport przychodów od mieszkańców (NZ) w formacie XLSX.</CardDescription>
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
                        <span className="ml-2">Generuj raport (NZ)</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

const ExcelImportGuideDialog = ({
    open,
    onOpenChange,
    onContinue,
    title,
    requiredFields,
    optionalFields,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onContinue: () => void;
    title: string;
    requiredFields: string[];
    optionalFields: string[];
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Upewnij się, że Twój plik Excel ma poprawną strukturę przed importem. Nazwy kolumn nie uwzględniają wielkości liter.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mr-6 pr-6">
                    <div className="space-y-4 p-1">
                        <div>
                            <h4 className="font-semibold mb-2">Kolumny Wymagane</h4>
                            <div className="flex flex-wrap gap-2">
                                {requiredFields.map(field => (
                                    <Badge key={field} variant="destructive">{field}</Badge>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Te kolumny muszą istnieć i być wypełnione dla każdego rekordu.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Kolumny Opcjonalne</h4>
                            <div className="flex flex-wrap gap-2">
                                {optionalFields.map(field => (
                                    <Badge key={field} variant="secondary">{field}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
                    <Button onClick={onContinue}>Zrozumiałem, kontynuuj</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ExcelImport = ({ onImport, title, description, requiredFields, optionalFields, isLoading }: {
    onImport: (fileContent: string) => Promise<void>;
    title: string;
    description: string;
    requiredFields: string[];
    optionalFields: string[];
    isLoading: boolean;
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result;
            if (typeof content === 'string') {
                const base64Content = content.split(',')[1];
                await onImport(base64Content);
            }
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleContinueImport = () => {
        setIsGuideOpen(false);
        fileInputRef.current?.click();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                />
                <Button onClick={() => setIsGuideOpen(true)} disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="mr-2 h-4 w-4" />
                    )}
                    Wybierz plik i importuj
                </Button>
                <ExcelImportGuideDialog
                    open={isGuideOpen}
                    onOpenChange={setIsGuideOpen}
                    onContinue={handleContinueImport}
                    title={`Przewodnik importu: ${title}`}
                    requiredFields={requiredFields}
                    optionalFields={optionalFields}
                />
            </CardContent>
        </Card>
    );
}

function SettingsManager({ rawSettings, handleUpdateSettings }: { rawSettings: Settings, handleUpdateSettings: (settings: Partial<Settings>) => Promise<void> }) {
    const { toast } = useToast();
    const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const { allEmployees, allNonEmployees } = useMainLayout();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
        defaultValues: {
            nationalities: rawSettings.nationalities.map(n => ({ value: n })).sort((a, b) => a.value.localeCompare(b.value)),
            departments: rawSettings.departments.map(d => ({ value: d })).sort((a, b) => a.value.localeCompare(b.value)),
            genders: rawSettings.genders.map(g => ({ value: g })).sort((a, b) => a.value.localeCompare(b.value)),
            localities: rawSettings.localities.map(l => ({ value: l })).sort((a, b) => a.value.localeCompare(b.value)),
            paymentTypesNZ: rawSettings.paymentTypesNZ.map(p => ({ value: p })).sort((a, b) => a.value.localeCompare(b.value)),
            statuses: (rawSettings.statuses || []).map(s => ({ value: s })).sort((a, b) => a.value.localeCompare(b.value)),
            bokRoles: (rawSettings.bokRoles || []).map(r => ({ value: r })).sort((a, b) => a.value.localeCompare(b.value)),
            bokReturnOptions: (rawSettings.bokReturnOptions || []).map(r => ({ value: r })).sort((a, b) => a.value.localeCompare(b.value)),
            addresses: [...rawSettings.addresses].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
            coordinators: [...rawSettings.coordinators].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        },
    });

    useEffect(() => {
        form.reset({
            nationalities: rawSettings.nationalities.map(n => ({ value: n })).sort((a, b) => a.value.localeCompare(b.value)),
            departments: rawSettings.departments.map(d => ({ value: d })).sort((a, b) => a.value.localeCompare(b.value)),
            genders: rawSettings.genders.map(g => ({ value: g })).sort((a, b) => a.value.localeCompare(b.value)),
            localities: rawSettings.localities.map(l => ({ value: l })).sort((a, b) => a.value.localeCompare(b.value)),
            paymentTypesNZ: rawSettings.paymentTypesNZ.map(p => ({ value: p })).sort((a, b) => a.value.localeCompare(b.value)),
            statuses: (rawSettings.statuses || []).map(s => ({ value: s })).sort((a, b) => a.value.localeCompare(b.value)),
            bokRoles: (rawSettings.bokRoles || []).map(r => ({ value: r })).sort((a, b) => a.value.localeCompare(b.value)),
            bokReturnOptions: (rawSettings.bokReturnOptions || []).map(r => ({ value: r })).sort((a, b) => a.value.localeCompare(b.value)),
            addresses: [...rawSettings.addresses].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
            coordinators: [...rawSettings.coordinators].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        });
    }, [rawSettings, form]);

    const { fields: natFields, append: appendNat, remove: removeNat } = useFieldArray({ control: form.control, name: 'nationalities' });
    const { fields: depFields, append: appendDep, remove: removeDep } = useFieldArray({ control: form.control, name: 'departments' });
    const { fields: genFields, append: appendGen, remove: removeGen } = useFieldArray({ control: form.control, name: 'genders' });
    const { fields: locFields, append: appendLoc, remove: removeLoc } = useFieldArray({ control: form.control, name: 'localities' });
    const { fields: paymentNzFields, append: appendPaymentNz, remove: removePaymentNz } = useFieldArray({ control: form.control, name: 'paymentTypesNZ' });
    const { fields: statusFields, append: appendStatus, remove: removeStatus } = useFieldArray({ control: form.control, name: 'statuses' });
    const { fields: bokRoleFields, append: appendBokRole, remove: removeBokRole } = useFieldArray({ control: form.control, name: 'bokRoles' });
    const { fields: bokReturnOptionFields, append: appendBokReturnOption, remove: removeBokReturnOption } = useFieldArray({ control: form.control, name: 'bokReturnOptions' });
    const { fields: coordFields, append: appendCoord, remove: removeCoord } = useFieldArray({ control: form.control, name: 'coordinators' });

    const watchedAddresses = useWatch({ control: form.control, name: 'addresses' });
    const watchedCoordinators = useWatch({ control: form.control, name: 'coordinators' });
    const watchedLocalities = useWatch({ control: form.control, name: 'localities' });
    const watchedDepartments = useWatch({ control: form.control, name: 'departments' });

    const onSubmit = async ({ addresses: _addresses, ...otherValues }: z.infer<typeof formSchema>) => {
        const newSettings: Partial<Settings> = {
            nationalities: otherValues.nationalities.map((n) => n.value).sort((a, b) => a.localeCompare(b)),
            departments: otherValues.departments.map((d) => d.value).sort((a, b) => a.localeCompare(b)),
            genders: otherValues.genders.map((d) => d.value).sort((a, b) => a.localeCompare(b)),
            localities: otherValues.localities.map((l) => l.value).sort((a, b) => a.localeCompare(b)),
            paymentTypesNZ: otherValues.paymentTypesNZ.map((p) => p.value).sort((a, b) => a.localeCompare(b)),
            statuses: otherValues.statuses.map((s) => s.value).sort((a, b) => a.localeCompare(b)),
            bokRoles: otherValues.bokRoles.map((s) => s.value).sort((a, b) => a.localeCompare(b)),
            bokReturnOptions: otherValues.bokReturnOptions.map((s) => s.value).sort((a, b) => a.localeCompare(b)),
            coordinators: otherValues.coordinators.sort((a, b) => a.name.localeCompare(b.name)),
        };

        form.reset(form.getValues()); // Reset dirty state to disable button
        toast({ title: "Zapisywanie...", description: "Zmiany są zapisywane w tle." });

        try {
            await handleUpdateSettings(newSettings);
            toast({ title: "Sukces", description: "Ustawienia list i koordynatorów zostały zaktualizowane." });

            form.reset({
                ...form.getValues(),
                nationalities: newSettings.nationalities?.map(n => ({ value: n })),
                departments: newSettings.departments?.map(d => ({ value: d })),
                genders: newSettings.genders?.map(g => ({ value: g })),
                localities: newSettings.localities?.map(l => ({ value: l })),
                paymentTypesNZ: newSettings.paymentTypesNZ?.map(p => ({ value: p })),
                statuses: newSettings.statuses?.map(s => ({ value: s })),
                bokRoles: newSettings.bokRoles?.map(r => ({ value: r })),
                bokReturnOptions: newSettings.bokReturnOptions?.map(r => ({ value: r })),
                coordinators: newSettings.coordinators,
            });
        } catch (e) {
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać ustawień. Cofnięto zmiany." });
        }
    };

    const handleAddressFormOpen = (address: Address | null) => {
        setEditingAddress(address);
        setIsAddressFormOpen(true);
    };

    const handleSaveAddress = async (addressData: Address) => {
        const addresses = rawSettings.addresses;
        const addressIndex = addresses.findIndex(a => a.id === addressData.id);
        const newAddresses = [...addresses];

        if (addressIndex > -1) {
            newAddresses[addressIndex] = addressData;
        } else {
            newAddresses.push(addressData);
        }

        const previousSettings = rawSettings;
        form.setValue('addresses', newAddresses, { shouldDirty: false });
        setIsAddressFormOpen(false);
        toast({ title: "Zapisywanie...", description: "Adres jest zapisywany w tle." });

        try {
            await handleUpdateSettings({ addresses: newAddresses });
            toast({ title: "Sukces", description: "Adres został zapisany." });
        } catch (e) {
            // Rollback
            form.setValue('addresses', previousSettings.addresses, { shouldDirty: false });
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się zapisać adresu. Cofnięto zmiany." });
        }
    };

    const handleRemoveAddress = async (addressId: string) => {
        const addresses = rawSettings.addresses;
        const newAddresses = addresses.filter((a: Address) => a.id !== addressId);

        const previousSettings = rawSettings;
        form.setValue('addresses', newAddresses, { shouldDirty: false });
        toast({ title: "Usuwanie...", description: "Adres jest usuwany w tle." });

        try {
            await handleUpdateSettings({ addresses: newAddresses });
            toast({ title: "Sukces", description: "Adres został usunięty." });
        } catch (e) {
            // Rollback
            form.setValue('addresses', previousSettings.addresses, { shouldDirty: false });
            toast({ variant: "destructive", title: "Błąd", description: e instanceof Error ? e.message : "Nie udało się usunąć adresu. Cofnięto zmiany." });
        }
    }

    const handleAddAddress = (coordinatorId: string) => {
        const newAddress: Address = {
            id: `addr-${Date.now()}`,
            name: '',
            locality: '',
            coordinatorIds: coordinatorId === 'all' ? [] : [coordinatorId],
            rooms: [],
            isActive: true,
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
                                <AccordionContent className="p-2">
                                    <Accordion type="multiple" className="w-full space-y-2">
                                        <ListManager name="nationalities" title="Narodowości" fields={natFields} append={appendNat} remove={removeNat} control={form.control} />
                                        <ListManager name="departments" title="Zakłady" fields={depFields} append={appendDep} remove={removeDep} control={form.control} />
                                        <ListManager name="genders" title="Płcie" fields={genFields} append={appendGen} remove={removeGen} control={form.control} />
                                        <ListManager name="localities" title="Miejscowości" fields={locFields} append={appendLoc} remove={removeLoc} control={form.control} />
                                        <ListManager name="paymentTypesNZ" title="Rodzaje płatności NZ" fields={paymentNzFields} append={appendPaymentNz} remove={removePaymentNz} control={form.control} />
                                        <ListManager name="statuses" title="Statusy" fields={statusFields} append={appendStatus} remove={removeStatus} control={form.control} />
                                        <div className="py-2"><div className="border-t"></div></div>
                                        <p className="text-sm font-semibold text-muted-foreground mb-2">Ustawienia BOK</p>
                                        <ListManager name="bokRoles" title="Kierowcy BOK" fields={bokRoleFields} append={appendBokRole} remove={removeBokRole} control={form.control} />
                                        <ListManager name="bokReturnOptions" title="Opcje Powrotu BOK" fields={bokReturnOptionFields} append={appendBokReturnOption} remove={removeBokReturnOption} control={form.control} />
                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="coordinators">
                                <AccordionTrigger>Zarządzanie koordynatorami</AccordionTrigger>
                                <AccordionContent className="p-2">
                                    <CoordinatorManager
                                        form={form}
                                        fields={coordFields}
                                        append={appendCoord}
                                        remove={removeCoord}
                                        departments={(watchedDepartments || []).map((d: { value: string }) => d.value)}
                                    />
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
                                        allEmployees={allEmployees || []}
                                        allNonEmployees={allNonEmployees || []}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Zapisz zmiany
                            </Button>
                        </div>
                    </form>
                </Form>
                {rawSettings && (
                    <AddressForm
                        key={editingAddress ? editingAddress.id : 'new-address'}
                        isOpen={isAddressFormOpen}
                        onOpenChange={setIsAddressFormOpen}
                        onSave={handleSaveAddress}
                        settings={rawSettings}
                        address={editingAddress}
                    />
                )}
            </CardContent>
        </Card>
    )
}

export default function SettingsView({ currentUser }: { currentUser: SessionData }) {
    const { toast } = useToast();
    const { handleImportEmployees, handleImportNonEmployees, handleImportBokResidents, handleUpdateSettings, rawSettings } = useMainLayout();
    const [isEmployeeImportLoading, setIsEmployeeImportLoading] = useState(false);
    const [isNonEmployeeImportLoading, setIsNonEmployeeImportLoading] = useState(false);
    const [isBokImportLoading, setIsBokImportLoading] = useState(false);

    const runEmployeeImport = async (fileContent: string) => {
        if (!rawSettings) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Ustawienia nie są załadowane. Spróbuj ponownie za chwilę.' });
            return;
        }
        setIsEmployeeImportLoading(true);
        await handleImportEmployees(fileContent, rawSettings);
        setIsEmployeeImportLoading(false);
    }

    const runNonEmployeeImport = async (fileContent: string) => {
        if (!rawSettings) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Ustawienia nie są załadowane. Spróbuj ponownie za chwilę.' });
            return;
        }
        setIsNonEmployeeImportLoading(true);
        await handleImportNonEmployees(fileContent, rawSettings);
        setIsNonEmployeeImportLoading(false);
    }

    const runBokResidentImport = async (fileContent: string) => {
        if (!rawSettings) {
            toast({ variant: 'destructive', title: 'Błąd', description: 'Ustawienia nie są załadowane. Spróbuj ponownie za chwilę.' });
            return;
        }
        setIsBokImportLoading(true);
        await handleImportBokResidents(fileContent, rawSettings);
        setIsBokImportLoading(false);
    }

    const employeeRequiredFields = ["Imię", "Nazwisko", "Koordynator", "Data zameldowania", "Zakład", "Miejscowość", "Adres", "Pokój", "Narodowość"];
    const employeeOptionalFields = ["Płeć", "Umowa od", "Umowa do", "Data wymeldowania", "Data zgloszenia wyjazdu", "Komentarze"];

    const nonEmployeeRequiredFields = ["Imię", "Nazwisko", "Koordynator", "Data zameldowania", "Miejscowość", "Adres", "Pokój", "Narodowość"];
    const nonEmployeeOptionalFields = ["Płeć", "Data wymeldowania", "Data zgloszenia wyjazdu", "Komentarze", "Rodzaj płatności NZ", "Kwota"];

    const bokResidentRequiredFields = ["Imię", "Nazwisko", "Koordynator", "Data zameldowania", "Miejscowość", "Adres", "Pokój", "Narodowość", "Rola", "Zakład"];
    const bokResidentOptionalFields = ["Płeć", "Opcja powrotu", "Data wymeldowania", "Status", "Komentarze"];

    if (!currentUser.isAdmin) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center text-destructive"><FileWarning className="mr-2" />Brak uprawnień</CardTitle>
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
            <SettingsManager rawSettings={rawSettings} handleUpdateSettings={handleUpdateSettings} />
            <DataMigration />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ExcelImport
                    onImport={runEmployeeImport}
                    title="Import Pracowników"
                    description="Zaimportuj nowych pracowników z pliku XLSX."
                    requiredFields={employeeRequiredFields}
                    optionalFields={employeeOptionalFields}
                    isLoading={isEmployeeImportLoading}
                />
                <ExcelImport
                    onImport={runNonEmployeeImport}
                    title="Import Mieszkańców (NZ)"
                    description="Zaimportuj nowych mieszkańców (NZ) z pliku XLSX."
                    requiredFields={nonEmployeeRequiredFields}
                    optionalFields={nonEmployeeOptionalFields}
                    isLoading={isNonEmployeeImportLoading}
                />
                <ExcelImport
                    onImport={runBokResidentImport}
                    title="Import Pracowników BOK"
                    description="Zaimportuj nowych pracowników BOK z pliku XLSX."
                    requiredFields={bokResidentRequiredFields}
                    optionalFields={bokResidentOptionalFields}
                    isLoading={isBokImportLoading}
                />
            </div>
            <div className="space-y-6">
                <AccommodationReportGenerator rawSettings={rawSettings} currentUser={currentUser} />
                <NzReportsGenerator rawSettings={rawSettings} currentUser={currentUser} />
            </div>
            <BulkActions currentUser={currentUser} rawSettings={rawSettings} />
        </div>
    );
}
