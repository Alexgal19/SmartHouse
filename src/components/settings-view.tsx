

"use client";

import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMainLayout } from '@/components/main-layout';
import type { Settings, SessionData, Address } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle, Download, Upload, Loader2, FileWarning, Edit } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateMonthlyReport, generateAccommodationReport, getSignedUploadUrl, bulkImportEmployees } from '@/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const coordinatorSchema = z.object({
    uid: z.string(),
    name: z.string().min(1, 'Imię jest wymagane.'),
    password: z.string().min(1, 'Hasło jest wymagane.'),
    isAdmin: z.boolean(),
});

const formSchema = z.object({
  nationalities: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  departments: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  genders: z.array(z.object({ value: z.string().min(1, 'Wartość nie może być pusta.') })),
  addresses: z.array(z.any()), // Simplified for top-level form, validation will be in the dialog
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

const CoordinatorManager = ({ form, fields, append, remove }: { form: any, fields: any[], append: any, remove: any }) => (
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
            <p className="font-semibold">{form.getValues(`coordinators.${index}.name`) || `Nowy koordynator`}</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
        <FormField
          control={form.control}
          name={`coordinators.${index}.name`}
          render={({ field: nameField }) => (
            <FormItem>
              <FormLabel>Imię</FormLabel>
              <FormControl><Input {...nameField} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`coordinators.${index}.password`}
          render={({ field: passField }) => (
            <FormItem>
              <FormLabel>Hasło</FormLabel>
              <FormControl><Input type="password" {...passField} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
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

const AddressManager = ({ form, onEdit, onRemove, onAdd }: { form: any; onEdit: (address: Address) => void; onRemove: (addressId: string) => void; onAdd: (coordinatorId: string) => void; }) => {
    const [filterCoordinatorId, setFilterCoordinatorId] = useState('all');
    const coordinatorMap = useMemo(() => new Map((useWatch({ control: form.control, name: 'coordinators' })).map((c: { uid: any; name: any; }) => [c.uid, c.name])), [(useWatch({ control: form.control, name: 'coordinators' }))]);

    const filteredAddresses = useMemo(() => {
        if (!useWatch({ control: form.control, name: 'addresses' })) return [];
        if (filterCoordinatorId === 'all') return useWatch({ control: form.control, name: 'addresses' });
        return (useWatch({ control: form.control, name: 'addresses' })).filter((a: { coordinatorId: string; }) => a.coordinatorId === filterCoordinatorId);
    }, [(useWatch({ control: form.control, name: 'addresses' })), filterCoordinatorId]);

    return (
        <div className="space-y-4 rounded-md border p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="font-medium">Adresy i pokoje</h3>
                 <div className="flex w-full sm:w-auto items-center gap-2">
                    <Select value={filterCoordinatorId} onValueChange={setFilterCoordinatorId}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Filtruj wg koordynatora" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszyscy koordynatorzy</SelectItem>
                            {(useWatch({ control: form.control, name: 'coordinators' })).map((c: { uid: string; name: string; }) => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdd(filterCoordinatorId)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj adres
                    </Button>
                 </div>
            </div>
            {filteredAddresses && filteredAddresses.length > 0 ? (
                <div className="space-y-2">
                    {filteredAddresses.map((address: { id: any; name: any; coordinatorId: any; rooms: any; }) => (
                        <div key={address.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="font-semibold">{address.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {coordinatorMap.get(address.coordinatorId) || 'Brak koordynatora'}, {address.rooms.length} pokoi
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
                <p className="text-sm text-muted-foreground text-center py-2">Brak zdefiniowanych adresów dla wybranego koordynatora.</p>
            )}
        </div>
    );
};


const BulkActions = ({ currentUser }: { currentUser: SessionData }) => {
    const { toast } = useToast();
    const router = useRouter();
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.xlsx')) {
            toast({
                variant: 'destructive',
                title: 'Nieprawidłowy format pliku',
                description: 'Proszę wybrać plik w formacie .xlsx.',
            });
            return;
        }

        setIsImporting(true);
        toast({ title: 'Rozpoczynanie importu...', description: 'Plik jest przesyłany na serwer. To może zająć chwilę.' });

        try {
            // 1. Get signed URL from server
            const signedUrlResult = await getSignedUploadUrl(file.name, file.type, currentUser.uid);
            if (!signedUrlResult.success || !signedUrlResult.url || !signedUrlResult.jobId) {
                throw new Error(signedUrlResult.message || 'Nie udało się uzyskać adresu URL do załadowania.');
            }
            
            const { url, jobId } = signedUrlResult;

            // 2. Upload file to GCS
            await axios.put(url, file, {
                headers: { 'Content-Type': file.type },
            });
            
            toast({ title: 'Przesłano!', description: 'Plik został przesłany, rozpoczynanie przetwarzania w tle.' });

            // 3. Trigger background processing
            await bulkImportEmployees(jobId, `imports/${jobId}-${file.name}`, currentUser.uid);

            router.push(`/dashboard?view=import-status&jobId=${jobId}`);
            
        } catch (error) {
            console.error("Import error:", error);
            const errorMessage = error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd podczas importu.";
            toast({ variant: 'destructive', title: 'Błąd importu', description: String(errorMessage), duration: 10000 });
        } finally {
            if(fileInputRef.current) fileInputRef.current.value = '';
            setIsImporting(false);
        }
    };
    
    const { handleBulkDeleteEmployees } = useMainLayout();
    const [isDeletingActive, setIsDeletingActive] = useState(false);
    const [isDeletingDismissed, setIsDeletingDismissed] = useState(false);
    
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
  const { settings, handleUpdateSettings, handleAddressFormOpen } = useMainLayout();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
  });

  const { fields: natFields, append: appendNat, remove: removeNat } = useFieldArray({ control: form.control, name: 'nationalities' });
  const { fields: depFields, append: appendDep, remove: removeDep } = useFieldArray({ control: form.control, name: 'departments' });
  const { fields: genFields, append: appendGen, remove: removeGen } = useFieldArray({ control: form.control, name: 'genders' });
  const { fields: coordFields, append: appendCoord, remove: removeCoord } = useFieldArray({ control: form.control, name: 'coordinators' });
  const { remove: removeAddr } = useFieldArray({ control: form.control, name: 'addresses' });

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
    const currentValues = form.getValues();
    const newSettings: Partial<Settings> = {
        nationalities: currentValues.nationalities.map(n => n.value),
        departments: currentValues.departments.map(d => d.value),
        genders: currentValues.genders.map(d => d.value),
        addresses: currentValues.addresses,
        coordinators: currentValues.coordinators,
    };
    await handleUpdateSettings(newSettings);
    form.reset(currentValues); // Resets the dirty state
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
        coordinatorId: coordinatorId === 'all' ? '' : coordinatorId,
        rooms: [],
    };
    handleAddressFormOpen(newAddress);
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
                     <Accordion type="single" collapsible className="w-full">
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
                                <CoordinatorManager form={form} fields={coordFields} append={appendCoord} remove={removeCoord} />
                             </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="addresses">
                             <AccordionTrigger>Zarządzanie adresami</AccordionTrigger>
                             <AccordionContent className="p-2">
                                <AddressManager 
                                    form={form} 
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
    
    <ReportsGenerator settings={settings} currentUser={currentUser} />

    <BulkActions currentUser={currentUser} />

    </div>
  );
}
