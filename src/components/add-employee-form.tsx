"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Employee, Settings, Address, SessionData } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Info, X, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse, isValid, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  fullName: z.string().min(3, "Imię i nazwisko musi mieć co najmniej 3 znaki."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  locality: z.string().min(1, "Miejscowość jest wymagana."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Numer pokoju jest wymagany."),
  zaklad: z.string().nullable(),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  gender: z.string().min(1, "Płeć jest wymagana."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }).nullable(),
  checkOutDate: z.date().nullable().optional(),
  contractStartDate: z.date().nullable().optional(),
  contractEndDate: z.date().nullable().optional(),
  departureReportDate: z.date().nullable().optional(),
  comments: z.string().optional(),
  oldAddress: z.string().optional(),
  addressChangeDate: z.date().nullable().optional(),
  depositReturned: z.enum(['Tak', 'Nie', 'Nie dotyczy']).nullable().optional(),
  depositReturnAmount: z.number().nullable().optional(),
  deductionRegulation: z.number().nullable().optional(),
  deductionNo4Months: z.number().nullable().optional(),
  deductionNo30Days: z.number().nullable().optional(),
  deductionReason: z.array(z.object({
      id: z.string(),
      label: z.string(),
      amount: z.number().nullable(),
      checked: z.boolean(),
  })).optional(),
  deductionEntryDate: z.date().nullable().optional(),
}).superRefine((data, ctx) => {
    const hasDeductions = 
        data.depositReturned === 'Nie' ||
        (data.depositReturnAmount ?? 0) > 0 ||
        (data.deductionRegulation ?? 0) > 0 ||
        (data.deductionNo4Months ?? 0) > 0 ||
        (data.deductionNo30Days ?? 0) > 0 ||
        (data.deductionReason || []).some(r => r.checked && (r.amount ?? 0) > 0);

    if (hasDeductions && !data.deductionEntryDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['deductionEntryDate'],
            message: 'Data jest wymagana, jeśli wprowadzono potrącenia lub kaucja nie jest zwracana.',
        });
    }
});


export type EmployeeFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'contractStartDate' | 'contractEndDate' | 'departureReportDate' | 'addressChangeDate' | 'deductionEntryDate' | 'locality'> & {
  checkInDate: string | null;
  checkOutDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  departureReportDate?: string | null;
  addressChangeDate?: string | null;
  deductionEntryDate?: string | null;
};

const defaultDeductionReasons: { label: string }[] = [
    { label: 'Zgubienie kluczy' },
    { label: 'Zniszczenie mienia' },
    { label: 'Palenie w pokoju' },
    { label: 'Niestosowanie się do regulaminu' },
];

const parseDate = (dateString: string | null | undefined): Date | undefined => {
    if (!dateString) return undefined;
    const date = parseISO(dateString); // Expect YYYY-MM-DD
    return isValid(date) ? date : undefined;
};

const DateInput = ({
  value,
  onChange,
  disabled,
}: {
  value?: Date | null;
  onChange: (date?: Date | null) => void;
  disabled?: (date: Date) => boolean;
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, 'yyyy-MM-dd'));
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value === '') {
        onChange(null);
        return;
    }
    const parsedDate = parse(e.target.value, 'yyyy-MM-dd', new Date());
    if (isValid(parsedDate)) {
      onChange(parsedDate);
    }
  };

  const handleDateSelect = (date?: Date | null) => {
    if (date && isValid(date)) {
      onChange(date);
      setInputValue(format(date, 'yyyy-MM-dd'));
      setIsPopoverOpen(false);
    } else {
      onChange(null);
      setInputValue('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleDateSelect(null);
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="rrrr-mm-dd"
            className="pr-10"
          />
           <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center">
            {value ? (
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" onClick={handleClear}/>
            ) : (
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            )}
           </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          locale={pl}
          mode="single"
          selected={value && isValid(value) ? value : undefined}
          onSelect={(d) => handleDateSelect(d)}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};


export function AddEmployeeForm({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  employee,
  currentUser
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: EmployeeFormData) => void;
  settings: Settings;
  employee: Employee | null;
  currentUser: SessionData;
}) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      coordinatorId: '',
      locality: '',
      address: '',
      roomNumber: '',
      zaklad: null,
      nationality: '',
      gender: '',
      checkInDate: new Date(),
      checkOutDate: null,
      contractStartDate: null,
      contractEndDate: null,
      departureReportDate: null,
      comments: '',
      oldAddress: '',
      addressChangeDate: null,
      depositReturned: null,
      depositReturnAmount: null,
      deductionRegulation: null,
      deductionNo4Months: null,
      deductionNo30Days: null,
      deductionReason: defaultDeductionReasons.map((reason, index) => ({
          ...reason,
          id: `reason-${index}`,
          amount: null,
          checked: false
      })),
      deductionEntryDate: null,
    },
  });
  
  const selectedCoordinatorId = form.watch('coordinatorId');
  const selectedLocality = form.watch('locality');
  const selectedAddress = form.watch('address');

  const availableLocalities = useMemo(() => {
    if (!selectedCoordinatorId || !settings.addresses) return [];
    
    const coordinatorAddresses = settings.addresses.filter(addr => 
        addr.coordinatorIds.includes(selectedCoordinatorId)
    );
    const localities = [...new Set(coordinatorAddresses.map(addr => addr.locality))];
    return localities.sort((a, b) => a.localeCompare(b));
  }, [settings.addresses, selectedCoordinatorId]);

  const availableAddresses = useMemo(() => {
    if (!selectedLocality || !selectedCoordinatorId) return [];
    const filtered = settings.addresses.filter(a => 
        a.locality === selectedLocality && a.coordinatorIds.includes(selectedCoordinatorId)
    );
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.addresses, selectedLocality, selectedCoordinatorId]);

  const availableRooms = useMemo(() => {
    const rooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];
    return [...rooms].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [settings.addresses, selectedAddress]);

  const availableDepartments = useMemo(() => {
    if (!selectedCoordinatorId) return [];
    const coordinator = settings.coordinators.find(c => c.uid === selectedCoordinatorId);
    return coordinator ? coordinator.departments.sort((a, b) => a.localeCompare(b)) : [];
  }, [settings.coordinators, selectedCoordinatorId]);

  useEffect(() => {
    if (employee) {
        const currentDeductions = employee.deductionReason || [];
        const combinedDeductions = defaultDeductionReasons.map((defaultReason, index) => {
            const existing = currentDeductions.find(r => r.label === defaultReason.label);
            return {
                id: `reason-${index}`,
                label: defaultReason.label,
                amount: existing?.amount ?? null,
                checked: existing?.checked ?? false,
            }
        });
        
        const employeeAddress = settings.addresses.find(a => a.name === employee.address);
        const employeeLocality = employeeAddress ? employeeAddress.locality : '';

        form.reset({
            fullName: employee.fullName ?? '',
            coordinatorId: employee.coordinatorId ?? '',
            locality: employeeLocality,
            address: employee.address ?? '',
            roomNumber: employee.roomNumber ?? '',
            zaklad: employee.zaklad ?? null,
            nationality: employee.nationality ?? '',
            gender: employee.gender ?? '',
            checkInDate: parseDate(employee.checkInDate) ?? null,
            checkOutDate: parseDate(employee.checkOutDate) ?? null,
            contractStartDate: parseDate(employee.contractStartDate) ?? null,
            contractEndDate: parseDate(employee.contractEndDate) ?? null,
            departureReportDate: parseDate(employee.departureReportDate) ?? null,
            comments: employee.comments ?? '',
            oldAddress: employee.oldAddress ?? '',
            addressChangeDate: parseDate(employee.addressChangeDate) ?? null,
            depositReturned: employee.depositReturned ?? null,
            depositReturnAmount: employee.depositReturnAmount ?? null,
            deductionRegulation: employee.deductionRegulation ?? null,
            deductionNo4Months: employee.deductionNo4Months ?? null,
            deductionNo30Days: employee.deductionNo30Days ?? null,
            deductionReason: combinedDeductions,
            deductionEntryDate: parseDate(employee.deductionEntryDate) ?? null,
        });
    } else {
        form.reset({
          fullName: '',
          coordinatorId: currentUser.isAdmin ? '' : currentUser.uid,
          locality: '',
          address: '',
          roomNumber: '',
          zaklad: null,
          nationality: '',
          gender: '',
          checkInDate: new Date(),
          checkOutDate: null,
          contractStartDate: null,
          contractEndDate: null,
          departureReportDate: null,
          comments: '',
            oldAddress: '',
          addressChangeDate: null,
          depositReturned: null,
          depositReturnAmount: null,
          deductionRegulation: null,
          deductionNo4Months: null,
          deductionNo30Days: null,
          deductionReason: defaultDeductionReasons.map((reason, index) => ({
              ...reason,
              id: `reason-${index}`,
              amount: null,
              checked: false
          })),
          deductionEntryDate: null,
        });
    }
  }, [employee, isOpen, form, settings.addresses, settings.coordinators, currentUser]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    
    if (employee) { // Check only on edit
        const addressChanged = values.address !== employee.address;
        const checkInDateChanged = values.checkInDate?.getTime() !== parseDate(employee.checkInDate)?.getTime();

        if (addressChanged && !checkInDateChanged) {
            toast({
                variant: 'destructive',
                title: 'Uwaga',
                description: 'Zmień datę zameldowania.',
            });
            return; // Stop submission
        }
    }

    const formatDate = (date: Date | null | undefined): string | null | undefined => {
        if (!date) return null;
        return format(date, 'yyyy-MM-dd');
    }

    const { locality, ...restOfValues } = values;

    const formData: EmployeeFormData = {
        ...restOfValues,
        checkInDate: formatDate(values.checkInDate),
        checkOutDate: formatDate(values.checkOutDate),
        contractStartDate: formatDate(values.contractStartDate),
        contractEndDate: formatDate(values.contractEndDate),
        departureReportDate: formatDate(values.departureReportDate),
        addressChangeDate: formatDate(values.addressChangeDate),
        deductionEntryDate: formatDate(values.deductionEntryDate),
    };

    onSave(formData);
    onOpenChange(false);
  };
  
  const handleCoordinatorChange = (value: string) => {
    form.setValue('coordinatorId', value);
    form.setValue('locality', '');
    form.setValue('address', '');
    form.setValue('roomNumber', '');
    form.setValue('zaklad', null);
  }

  const handleLocalityChange = (value: string) => {
    form.setValue('locality', value);
    form.setValue('address', '');
    form.setValue('roomNumber', '');
  }

  const handleAddressChange = (value: string) => {
    form.setValue('address', value);
    form.setValue('roomNumber', '');
  };

  const handleClearOldAddress = () => {
      form.setValue('oldAddress', '', { shouldDirty: true });
      form.setValue('addressChangeDate', null, { shouldDirty: true });
  }
  
  const sortedCoordinators = useMemo(() => [...settings.coordinators].sort((a, b) => a.name.localeCompare(b.name)), [settings.coordinators]);
  const sortedNationalities = useMemo(() => [...settings.nationalities].sort((a, b) => a.localeCompare(b)), [settings.nationalities]);
  const sortedGenders = useMemo(() => [...settings.genders].sort((a, b) => a.localeCompare(b)), [settings.genders]);

  const coordinatorOptions = useMemo(() => sortedCoordinators.map(c => ({ value: c.uid, label: c.name })), [sortedCoordinators]);
  const nationalityOptions = useMemo(() => sortedNationalities.map(n => ({ value: n, label: n })), [sortedNationalities]);
  const departmentOptions = useMemo(() => availableDepartments.map(d => ({ value: d, label: d })), [availableDepartments]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edytuj dane pracownika' : 'Dodaj nowego pracownika'}</DialogTitle>
          <DialogDescription>
            Wypełnij poniższe pola, aby {employee ? 'zaktualizować' : 'dodać'} pracownika.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Dane podstawowe</TabsTrigger>
                    <TabsTrigger value="finance">Finanse i potrącenia</TabsTrigger>
                </TabsList>
                <ScrollArea className="h-[60vh] mt-4">
                    <TabsContent value="basic">
                        <div className="space-y-4 px-4">
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Imię i nazwisko</FormLabel>
                                <FormControl><Input placeholder="Jan Kowalski" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="coordinatorId"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Koordynator</FormLabel>
                                    <Combobox
                                        options={coordinatorOptions}
                                        value={field.value}
                                        onChange={handleCoordinatorChange}
                                        placeholder="Wybierz koordynatora"
                                        searchPlaceholder="Szukaj koordynatora..."
                                    />
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="nationality"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Narodowość</FormLabel>
                                     <Combobox
                                        options={nationalityOptions}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Wybierz narodowość"
                                        searchPlaceholder="Szukaj narodowości..."
                                    />
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Płeć</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz płeć" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {sortedGenders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <FormField
                                control={form.control}
                                name="locality"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Miejscowość</FormLabel>
                                    <Select onValueChange={handleLocalityChange} value={field.value} disabled={!selectedCoordinatorId}>
                                        <FormControl><SelectTrigger><SelectValue placeholder={!selectedCoordinatorId ? "Najpierw wybierz koordynatora" : "Wybierz miejscowość"} /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {availableLocalities.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adres</FormLabel>
                                    <Select onValueChange={handleAddressChange} value={field.value} disabled={!selectedLocality}>
                                        <FormControl><SelectTrigger><SelectValue placeholder={!selectedLocality ? "Najpierw wybierz miejscowość" : "Wybierz adres"} /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {availableAddresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="roomNumber"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Pokój</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedAddress}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={!selectedAddress ? "Najpierw wybierz adres" : "Wybierz pokój"} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {availableRooms.map(r => <SelectItem key={r.id} value={r.name}>{r.name} (Pojemność: {r.capacity})</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="zaklad"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Zakład</FormLabel>
                                    <Combobox
                                        options={departmentOptions}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        placeholder={!selectedCoordinatorId ? "Najpierw wybierz koordynatora" : "Wybierz zakład"}
                                        searchPlaceholder="Szukaj zakładu..."
                                    />
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             <FormField
                                control={form.control}
                                name="checkInDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data zameldowania</FormLabel>
                                        <DateInput
                                          value={field.value}
                                          onChange={field.onChange}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                            <FormField
                                control={form.control}
                                name="checkOutDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data wymeldowania</FormLabel>
                                        <DateInput value={field.value} onChange={field.onChange} />
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                                 <FormField
                                control={form.control}
                                name="departureReportDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data zgłoszenia wyjazdu</FormLabel>
                                        <DateInput value={field.value} onChange={field.onChange} />
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="contractStartDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Umowa od</FormLabel>
                                        <DateInput value={field.value} onChange={field.onChange} />
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                            <FormField
                                control={form.control}
                                name="contractEndDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Umowa do</FormLabel>
                                        <DateInput value={field.value} onChange={field.onChange} />
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </div>
                        
                        <FormField
                            control={form.control}
                            name="comments"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Komentarze</FormLabel>
                                <FormControl><Input placeholder="Dodatkowe informacje..." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         {form.watch('oldAddress') && (
                            <div className="space-y-4 rounded-md border p-4 bg-muted/50">
                                <FormField
                                    control={form.control}
                                    name="oldAddress"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex justify-between items-center">
                                                <FormLabel>Poprzedni adres</FormLabel>
                                                {currentUser.isAdmin && (
                                                    <Button variant="ghost" size="sm" type="button" onClick={handleClearOldAddress}>
                                                        <Trash2 className="h-4 w-4 mr-2 text-destructive"/>
                                                        Wyczyść
                                                    </Button>
                                                )}
                                            </div>
                                            <FormControl><Input {...field} readOnly /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="addressChangeDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Data zmiany adresu</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} 
                                                    readOnly 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                        </div>
                    </TabsContent>
                    <TabsContent value="finance">
                        <div className="space-y-4 px-4">
                            <h3 className="text-lg font-medium">Finanse i potrącenia</h3>
                             <FormField
                                control={form.control}
                                name="deductionEntryDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Data wpisania potrącenia</FormLabel>
                                        <DateInput
                                          value={field.value}
                                          onChange={field.onChange}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="depositReturned"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Zwrot kaucji</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Status zwrotu kaucji" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Tak">Tak</SelectItem>
                                            <SelectItem value="Nie">Nie</SelectItem>
                                            <SelectItem value="Nie dotyczy">Nie dotyczy</SelectItem>
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="depositReturnAmount"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kwota zwrotu kaucji (PLN)</FormLabel>
                                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="deductionRegulation"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center">
                                            Potrącenie (Regulamin)
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Info className="h-3 w-3 ml-1 cursor-help" /></TooltipTrigger>
                                                    <TooltipContent><p>Potrącenie za nieprzestrzeganie regulaminu.</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </FormLabel>
                                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deductionNo4Months"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center">
                                            Potrącenie (4 msc)
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Info className="h-3 w-3 ml-1 cursor-help" /></TooltipTrigger>
                                                    <TooltipContent><p>Potrącenie za okres krótszy niż 4 miesiące.</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </FormLabel>
                                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deductionNo30Days"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center">
                                            Potrącenie (30 dni)
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Info className="h-3 w-3 ml-1 cursor-help" /></TooltipTrigger>
                                                    <TooltipContent><p>Potrącenie za wypowiedzenie krótsze niż 30 dni.</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </FormLabel>
                                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="deductionReason"
                                render={() => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base">Inne potrącenia</FormLabel>
                                            <p className="text-sm text-muted-foreground">
                                                Wybierz powody dodatkowych potrąceń.
                                            </p>
                                        </div>
                                        {(form.getValues('deductionReason') || []).map((reason, index) => (
                                        <FormField
                                            key={reason.id}
                                            control={form.control}
                                            name={`deductionReason.${index}.checked`}
                                            render={({ field }) => (
                                            <FormItem
                                                key={reason.id}
                                                className="flex flex-row items-start space-x-3 space-y-0"
                                            >
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none w-full grid grid-cols-2 gap-x-4 items-center">
                                                    <Label htmlFor={reason.id} className="font-normal">
                                                        {reason.label}
                                                    </Label>
                                                    <FormField
                                                        control={form.control}
                                                        name={`deductionReason.${index}.amount`}
                                                        render={({ field: amountField }) => (
                                                            <Input 
                                                                type="number" 
                                                                placeholder="PLN"
                                                                className="h-8"
                                                                {...amountField}
                                                                onChange={e => amountField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                                                                value={amountField.value ?? ''}
                                                            />
                                                        )}
                                                    />
                                                </div>
                                            </FormItem>
                                            )}
                                        />
                                        ))}
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </div>
                    </TabsContent>
                </ScrollArea>
            </Tabs>

            <DialogFooter className="p-6 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button type="submit">Zapisz</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
