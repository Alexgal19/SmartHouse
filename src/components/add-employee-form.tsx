
"use client";

import React, { useEffect, useState } from 'react';
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
import type { Employee, Settings } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Info, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formSchema = z.object({
  fullName: z.string().min(3, "Imię i nazwisko musi mieć co najmniej 3 znaki."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
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
});

export type EmployeeFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'contractStartDate' | 'contractEndDate' | 'departureReportDate'> & {
  checkInDate: string | null;
  checkOutDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  departureReportDate?: string | null;
};

const defaultDeductionReasons: { label: string }[] = [
    { label: 'Zgubienie kluczy' },
    { label: 'Zniszczenie mienia' },
    { label: 'Palenie w pokoju' },
    { label: 'Niestosowanie się do regulaminu' },
];

const parseDate = (dateString: string | null | undefined): Date | undefined => {
    if (!dateString) return undefined;
    const date = new Date(dateString + 'T00:00:00'); // Treat as local date
    return isNaN(date.getTime()) ? undefined : date;
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
    if (value) {
      setInputValue(format(value, 'dd-MM-yyyy'));
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
    const parsedDate = parse(e.target.value, 'dd-MM-yyyy', new Date());
    if (!isNaN(parsedDate.getTime())) {
      onChange(parsedDate);
    }
  };

  const handleDateSelect = (date?: Date | null) => {
    if (date) {
      onChange(date);
      setInputValue(format(date, 'dd-MM-yyyy'));
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
            placeholder="dd-mm-rrrr"
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
          mode="single"
          selected={value || undefined}
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
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: EmployeeFormData) => void;
  settings: Settings;
  employee: Employee | null;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      coordinatorId: '',
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
      }))
    },
  });
  
  const selectedAddress = form.watch('address');
  const availableRooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];

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

        form.reset({
            fullName: employee.fullName ?? '',
            coordinatorId: employee.coordinatorId ?? '',
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
            depositReturned: employee.depositReturned ?? null,
            depositReturnAmount: employee.depositReturnAmount ?? null,
            deductionRegulation: employee.deductionRegulation ?? null,
            deductionNo4Months: employee.deductionNo4Months ?? null,
            deductionNo30Days: employee.deductionNo30Days ?? null,
            deductionReason: combinedDeductions
        });
    } else {
        form.reset({
          fullName: '',
          coordinatorId: '',
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
          }))
        });
    }
  }, [employee, isOpen, form]);
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const formatDate = (date: Date | null | undefined): string | null | undefined => {
        if (!date) return null;
        return format(date, 'yyyy-MM-dd');
    }

    const formData: EmployeeFormData = {
        ...values,
        checkInDate: formatDate(values.checkInDate),
        checkOutDate: formatDate(values.checkOutDate),
        contractStartDate: formatDate(values.contractStartDate),
        contractEndDate: formatDate(values.contractEndDate),
        departureReportDate: formatDate(values.departureReportDate),
    };

    onSave(formData);
    onOpenChange(false);
  };
  
  const handleAddressChange = (value: string) => {
    form.setValue('address', value);
    form.setValue('roomNumber', '');
  };

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
                                <FormItem>
                                    <FormLabel>Koordynator</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz koordynatora" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {settings.coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="nationality"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Narodowość</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz narodowość" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {settings.nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
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
                                        {settings.genders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                                name="address"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adres</FormLabel>
                                    <Select onValueChange={handleAddressChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz adres" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {settings.addresses.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
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
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz pokój" /></SelectTrigger></FormControl>
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
                                <FormItem>
                                    <FormLabel>Zakład</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz zakład" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {settings.departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
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
                        </div>
                    </TabsContent>
                    <TabsContent value="finance">
                        <div className="space-y-4 px-4">
                            <h3 className="text-lg font-medium">Finanse i potrącenia</h3>
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
                                        {form.getValues('deductionReason')?.map((reason, index) => (
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
