
"use client";

import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMainLayout } from '@/components/main-layout';
import type { Settings, SessionData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle, Download, Upload, Loader2, FileWarning } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateMonthlyReport, generateAccommodationReport } from '@/lib/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';


const roomSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nazwa pokoju jest wymagana.'),
  capacity: z.coerce.number().min(1, 'Pojemność musi być większa od 0.'),
});

const addressSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nazwa adresu jest wymagana.'),
  coordinatorId: z.string().min(1, 'Koordynator jest wymagany.'),
  rooms: z.array(roomSchema),
});

const coordinatorSchema = z.object({
    uid: z.string(),
    name: z.string().min(1, 'Imię jest wymagane.'),
    password: z.string().min(1, 'Hasło jest wymagane.'),
    isAdmin: z.boolean(),
});

const formSchema = z.object({
  nationalities: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  departments: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  genders: z.array(z.object({ value: z.string().min(1_i 'Wartość nie może być pusta.') })),
  addresses: z.array(addressSchema),
  coordinators: z.array(coordinatorSchema),
});

const ListManager = ({ name, title, fields, append, remove }: { name: string; title: string; fields: any[]; append: any; remove: any; }) => (
    <div className="space-y-2 rounded-md border p-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">{title}</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Dodaj
            </Button>
        </div>
        {fields.map((field, index) => (
            <FormField
                key={field.id}
                name={`${name}.${index}.value`}
                render={({ field: formField }) => (
                    <FormItem className="flex items-center gap-2">
                        <FormControl>
                            <Input {...formField} />
                        </FormControl>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </FormItem>
                )}
            />
        ))}
        {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Brak pozycji na liście.</p>}
    </div>
);

const CoordinatorManager = ({ control, fields, append, remove, coordinators }: { control: any, fields: any[], append: any, remove: any, coordinators: any[] }) => (
  <div className="space-y-4 rounded-md border p-4">
    <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Koordynatorzy</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ uid: `coord-${Date.now()}`, name: '', password: '', isAdmin: false })}>
            <PlusCircle className="mr-2 h-4 w-4" /> Dodaj koordynatora
        </Button>
    </div>

    {fields.map((field, index) => (
      <div key={field.id} className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
            <p className="font-semibold">{control.getValues(`coordinators.${index}.name`) || `Nowy koordynator`}</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
        <FormField
          control={control}
          name={`coordinators.${index}.name`}
          render={({ field: nameField }) => (
            <FormItem>
              <FormLabel>Imię</FormLabel>
              <FormControl><Input {...nameField} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`coordinators.${index}.password`}
          render={({ field: passField }) => (
            <FormItem>
              <FormLabel>Hasło</FormLabel>
              <FormControl><Input type="password" {...passField} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`coordinators.${index}.isAdmin`}
          render={({ field: adminField }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <FormLabel>Administrator</FormLabel>
                    <FormMessage />
                </div>
                <FormControl>
                    <Switch checked={adminField.value} onCheckedChange={adminField.onChange} />
                </FormControl>
            </FormItem>
          )}
        />
      </div>
    ))}
    {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Brak zdefiniowanych koordynatorów.</p>}
  </div>
);

const AddressManager = ({ control, fields, append, remove, coordinators }: { control: any; fields: any[]; append: any; remove: any; coordinators: any[] }) => {
  const { fields: roomFields, append: appendRoom, remove: removeRoom } = useFieldArray({ control, name: `addresses.${fields.length -1}.rooms` });
  
  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Adresy i pokoje</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `addr-${Date.now()}`, name: '', coordinatorId: '', rooms: [] })}>
            <PlusCircle className="mr-2 h-4 w-4" /> Dodaj adres
        </Button>
      </div>
      {fields.map((field, addressIndex) => (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
                 <p className="font-semibold">{control.getValues(`addresses.${addressIndex}.name`) || `Nowy adres`}</p>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(addressIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>

          <FormField
            control={control}
            name={`addresses.${addressIndex}.name`}
            render={({ field: nameField }) => (
              <FormItem>
                <FormLabel>Nazwa adresu</FormLabel>
                <FormControl><Input {...nameField} /></FormControl>
              </FormItem>
            )}
          />
           <FormField
            control={control}
            name={`addresses.${addressIndex}.coordinatorId`}
            render={({ field: coordField }) => (
                 <FormItem>
                    <FormLabel>Przypisany koordynator</FormLabel>
                    <Select onValueChange={coordField.onChange} defaultValue={coordField.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz koordynatora" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                    </SelectContent>
                    </Select>
                </FormItem>
            )}
            />
          
            <div className="pl-4 mt-2 space-y-2">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">Pokoje</h4>
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                        const currentRooms = control.getValues(`addresses.${addressIndex}.rooms`);
                        const newRooms = [...currentRooms, { id: `room-${Date.now()}`, name: '', capacity: 1 }];
                        control.setValue(`addresses.${addressIndex}.rooms`, newRooms);
                    }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj pokój
                    </Button>
                </div>
                 {control.getValues(`addresses.${addressIndex}.rooms`).map((room: any, roomIndex: number) => (
                    <div key={room.id} className="flex items-center gap-2">
                         <FormField
                            control={control}
                            name={`addresses.${addressIndex}.rooms.${roomIndex}.name`}
                            render={({ field: roomNameField }) => (
                                <FormItem className="flex-1">
                                    <FormControl><Input placeholder="Nazwa pokoju" {...roomNameField} /></FormControl>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={control}
                            name={`addresses.${addressIndex}.rooms.${roomIndex}.capacity`}
                            render={({ field: capacityField }) => (
                                <FormItem className="w-28">
                                    <FormControl><Input type="number" placeholder="Pojemność" {...capacityField} /></FormControl>
                                </FormItem>
                            )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => {
                            const currentRooms = control.getValues(`addresses.${addressIndex}.rooms`);
                            const newRooms = currentRooms.filter((_: any, i: number) => i !== roomIndex);
                            control.setValue(`addresses.${addressIndex}.rooms`, newRooms);
                        }}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                 {control.getValues(`addresses.${addressIndex}.rooms`).length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Brak pokoi dla tego adresu.</p>}

            </div>
        </div>
      ))}
       {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Brak zdefiniowanych adresów.</p>}
    </div>
  );
};

const BulkActions = ({ currentUser, settings }: { currentUser: SessionData; settings: Settings }) => {
    const { handleBulkDeleteEmployees, handleBulkImport } = useMainLayout();
    const { toast } = useToast();
    const [isImporting, setIsImporting] = useState(false);
    const [isDeletingActive, setIsDeletingActive] = useState(false);
    const [isDeletingDismissed, setIsDeletingDismissed] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const fileData = await file.arrayBuffer();
        const result = await handleBulkImport(fileData);
        setIsImporting(false);

        if (result.success) {
            toast({ title: 'Import udany', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Błąd importu', description: result.message, duration: 10000 });
        }
        
        if(fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const handleBulkDelete = async (status: 'active' | 'dismissed') => {
        if(status === 'active') setIsDeletingActive(true);
        else setIsDeletingDismissed(true);

        const success = await handleBulkDeleteEmployees('employee', status);
        
        if(status === 'active') setIsDeletingActive(false);
        else setIsDeletingDismissed(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Akcje masowe</CardTitle>
                <CardDescription>Zarządzaj danymi pracowników hurtowo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-4">
                    <div className="flex-1">
                        <h3 className="font-medium">Importuj pracowników z pliku</h3>
                        <p className="text-sm text-muted-foreground">Dodaj wielu pracowników naraz używając pliku XLSX.</p>
                    </div>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="w-full sm:w-auto">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Importuj
                    </Button>
                     <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={onFileSelect} />
                 </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 p-4 gap-4">
                    <div className="flex-1">
                        <h3 className="font-medium text-destructive">Masowe usuwanie</h3>
                        <p className="text-sm text-destructive/80">Te akcje są nieodwracalne.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeletingActive} className="w-full">
                                    {isDeletingActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Usuń aktywnych
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Czy na pewno chcesz usunąć WSZYSTKICH aktywnych pracowników?</AlertDialogTitle>
                                    <AlertDialogDescription>Ta operacja jest nieodwracalna. Wszyscy pracownicy ze statusem "aktywny" zostaną trwale usunięci.</AlertDialogDescription>
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
                                    Usuń zwolnionych
                                </Button>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Czy na pewno chcesz usunąć WSZYSTKICH zwolnionych pracowników?</AlertDialogTitle>
                                    <AlertDialogDescription>Ta operacja jest nieodwracalna. Wszyscy pracownicy ze statusem "zwolniony" zostaną trwale usunięci.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleBulkDelete('dismissed')}>Potwierdź i usuń</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                 </div>
            </CardContent>
        </Card>
    );
}

const ReportsGenerator = ({ settings, currentUser }: { settings: Settings; currentUser: SessionData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [reportType, setReportType] = useState<'monthly' | 'accommodation'>('monthly');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [coordinatorId, setCoordinatorId] = useState<string>(currentUser.isAdmin ? 'all' : currentUser.uid);
    const { toast } = useToast();

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const result = reportType === 'monthly'
                ? await generateMonthlyReport(year, month, coordinatorId)
                : await generateAccommodationReport(year, month, coordinatorId);
            
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
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generowanie raportów</CardTitle>
                <CardDescription>Wygeneruj raporty w formacie XLSX.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                    <div className="space-y-2">
                        <Label>Typ raportu</Label>
                        <Select value={reportType} onValueChange={(v: 'monthly' | 'accommodation') => setReportType(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Raport miesięczny</SelectItem>
                                <SelectItem value="accommodation">Raport zakwaterowania</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
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
                                    {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
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


export default function SettingsView({ currentUser }: { currentUser: SessionData }) {
  const { settings, handleUpdateSettings } = useMainLayout();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { fields: natFields, append: appendNat, remove: removeNat } = useFieldArray({ control: form.control, name: 'nationalities' });
  const { fields: depFields, append: appendDep, remove: removeDep } = useFieldArray({ control: form.control, name: 'departments' });
  const { fields: genFields, append: appendGen, remove: removeGen } = useFieldArray({ control: form.control, name: 'genders' });
  const { fields: addrFields, append: appendAddr, remove: removeAddr } = useFieldArray({ control: form.control, name: 'addresses' });
  const { fields: coordFields, append: appendCoord, remove: removeCoord } = useFieldArray({ control: form.control, name: 'coordinators' });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        nationalities: settings.nationalities.map(n => ({ value: n })),
        departments: settings.departments.map(d => ({ value: d })),
        genders: settings.genders.map(g => ({ value: g })),
        addresses: settings.addresses,
        coordinators: settings.coordinators,
      });
    }
  }, [settings, form]);
  
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const newSettings: Partial<Settings> = {
        nationalities: data.nationalities.map(n => n.value),
        departments: data.departments.map(d => d.value),
        genders: data.genders.map(d => d.value),
        addresses: data.addresses,
        coordinators: data.coordinators,
    };
    await handleUpdateSettings(newSettings);
  };
  
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

  if (!settings) {
       return (
            <div className="space-y-6">
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
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-32 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
  }

  return (
    <div className="space-y-6">
    <Card>
        <CardHeader>
            <CardTitle>Ustawienia aplikacji</CardTitle>
            <CardDescription>Zarządzaj globalnymi ustawieniami aplikacji, takimi jak listy, adresy i koordynatorzy.</CardDescription>
        </CardHeader>
        <CardContent>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Accordion type="multiple" className="w-full" defaultValue={['lists']}>
                        <AccordionItem value="lists">
                            <AccordionTrigger>Zarządzanie listami</AccordionTrigger>
                            <AccordionContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                                <ListManager name="nationalities" title="Narodowości" fields={natFields} append={appendNat} remove={removeNat} />
                                <ListManager name="departments" title="Zakłady" fields={depFields} append={appendDep} remove={removeDep} />
                                <ListManager name="genders" title="Płcie" fields={genFields} append={appendGen} remove={removeGen} />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="coordinators">
                             <AccordionTrigger>Zarządzanie koordynatorami</AccordionTrigger>
                             <AccordionContent className="p-2">
                                <CoordinatorManager control={form.control} fields={coordFields} append={appendCoord} remove={removeCoord} coordinators={form.watch('coordinators')} />
                             </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="addresses">
                             <AccordionTrigger>Zarządzanie adresami</AccordionTrigger>
                             <AccordionContent className="p-2">
                                <AddressManager control={form.control} fields={addrFields} append={appendAddr} remove={removeAddr} coordinators={form.watch('coordinators')} />
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
    
    <ReportsGenerator settings={settings} currentUser={currentUser} />

    <BulkActions currentUser={currentUser} settings={settings} />

    </div>
  );
}

