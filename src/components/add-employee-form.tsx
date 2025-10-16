
"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Employee, Settings, DeductionReason } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { format, isValid } from 'date-fns';
import { Loader2 } from "lucide-react";

const deductionReasonSchema = z.object({
    name: z.string(),
    checked: z.boolean(),
    amount: z.number().nullable().optional(),
});

export const employeeSchema = z.object({
  fullName: z.string().min(3, "Imię i nazwisko musi mieć co najmniej 3 znaki."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  gender: z.string().min(1, "Płeć jest wymagana."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Numer pokoju jest wymagany."),
  zaklad: z.string().min(1, "Zakład jest wymagany."),
  checkInDate: z.string({ required_error: "Data zameldowania jest wymagana." }).min(1, "Data zameldowania jest wymagana."),
  contractStartDate: z.string().nullable().optional(),
  contractEndDate: z.string().nullable().optional(),
  checkOutDate: z.string().nullable().optional(),
  departureReportDate: z.string().nullable().optional(),
  comments: z.string().optional(),
  oldAddress: z.string().optional().nullable(),
  addressChangeDate: z.string().optional().nullable(),
  // Financial fields
  depositReturned: z.enum(['Tak', 'Nie', 'Nie dotyczy']).optional().nullable(),
  depositReturnAmount: z.number().optional().nullable(),
  deductionRegulation: z.number().optional().nullable(),
  deductionNo4Months: z.number().optional().nullable(),
  deductionNo30Days: z.number().optional().nullable(),
  deductionReason: z.array(deductionReasonSchema).optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;


const deductionReasonsList = [
    "Rezygnacja", "Alkohol", "Brudne ściany", "Zniszczone wyposażenie",
    "Nie sprzątanie mieszkania", "Brudne kołdra i poduszka", "Uszkodzone drzwi", "Palenia papierosów"
];

const getDefaultDeductionReasons = (): DeductionReason[] =>
  deductionReasonsList.map(name => ({ name, checked: false, amount: null }));

interface AddEmployeeFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: EmployeeFormData) => Promise<void>;
  settings: Settings;
  employee?: Employee | null;
}

export function AddEmployeeForm({ isOpen, onOpenChange, onSave, settings, employee }: AddEmployeeFormProps) {
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      deductionReason: getDefaultDeductionReasons(),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "deductionReason",
  });

  const watchedDeductionReasons = useWatch({
    control: form.control,
    name: "deductionReason"
  })

  const watchedAddress = form.watch('address');
  const [initialAddress, setInitialAddress] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (isOpen) {
      let deductionReasonInitial: DeductionReason[] = getDefaultDeductionReasons();
      if (employee?.deductionReason) {
        // Merge saved reasons with default list to handle new reasons added to the app
        deductionReasonInitial = getDefaultDeductionReasons().map(defaultReason => {
            const savedReason = employee.deductionReason?.find(r => r.name === defaultReason.name);
            return savedReason ? { ...defaultReason, ...savedReason } : defaultReason;
        });
      }
      
      const todayString = format(new Date(), 'yyyy-MM-dd');

      const defaultVals: EmployeeFormData = {
        fullName: "",
        coordinatorId: "",
        nationality: "",
        gender: settings.genders[0] || "",
        address: "",
        roomNumber: "",
        zaklad: "",
        checkInDate: todayString,
        comments: "",
        depositReturned: 'Nie dotyczy' as const,
        deductionReason: deductionReasonInitial,
      };

      if (employee) {
        form.reset({
            ...defaultVals,
            ...employee,
        });
        setInitialAddress(employee.address);
      } else {
        form.reset(defaultVals);
        setInitialAddress(undefined);
      }
    }
  }, [employee, isOpen, form, settings.genders]);

  const showOldAddress = !!employee?.oldAddress || (employee && watchedAddress !== initialAddress && !!initialAddress);


  const handleSubmit = async (values: EmployeeFormData) => {
    const dataToSave: EmployeeFormData = { ...values };
    if (employee && watchedAddress !== initialAddress) {
      dataToSave.oldAddress = initialAddress;
      dataToSave.addressChangeDate = format(new Date(), 'yyyy-MM-dd');
    } else if (employee) {
      dataToSave.oldAddress = employee.oldAddress;
      dataToSave.addressChangeDate = employee.addressChangeDate;
    }
    
    await onSave(dataToSave);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edytuj pracownika' : 'Dodaj nowego pracownika'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 overflow-hidden flex flex-col">
           <Tabs defaultValue="main" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="shrink-0">
                <TabsTrigger value="main">Dane Główne</TabsTrigger>
                <TabsTrigger value="finance">Kaucja i Potrącenia</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto p-1 animate-in fade-in-0 duration-500">
              <TabsContent value="main" className="space-y-4 pt-4 px-2 data-[state=active]:animate-in data-[state=active]:fade-in-0">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imię i nazwisko</FormLabel>
                      <FormControl>
                        <Input placeholder="Jan Kowalski" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="nationality"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Narodowość</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz narodowość" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {settings.nationalities.map((n) => (
                                    <SelectItem key={n} value={n}>
                                    {n}
                                    </SelectItem>
                                ))}
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
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz płeć" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {settings.genders.map((g) => (
                                    <SelectItem key={g} value={g}>
                                    {g}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>
                <FormField
                    control={form.control}
                    name="coordinatorId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Koordynator</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz koordynatora" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {settings.coordinators.map((c) => (
                                <SelectItem key={c.uid} value={c.uid}>
                                {c.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <div className="space-y-2">
                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Adres</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz adres" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {settings.addresses.map((a) => (
                                    <SelectItem key={a.id} value={a.name}>
                                    {a.name}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    {showOldAddress && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormItem>
                            <FormLabel>Stara adresa</FormLabel>
                            <FormControl>
                            <Input value={employee?.oldAddress || initialAddress || ''} readOnly disabled className="bg-muted/50"/>
                            </FormControl>
                        </FormItem>
                         <FormField
                            control={form.control}
                            name="addressChangeDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel className="mb-1.5">Data zmiany adresu</FormLabel>
                                <DatePicker value={field.value} onChange={(val) => field.onChange(val || undefined)} />
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                     </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="roomNumber"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Numer pokoju</FormLabel>
                            <FormControl>
                                <Input placeholder="1A" {...field} />
                            </FormControl>
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
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz zakład" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {settings.departments.map((d) => (
                                    <SelectItem key={d} value={d}>
                                    {d}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="contractStartDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="mb-1.5">Umowa od</FormLabel>
                        <DatePicker value={field.value} onChange={field.onChange} />
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                        control={form.control}
                        name="contractEndDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel className="mb-1.5">Umowa do</FormLabel>
                            <DatePicker value={field.value} onChange={field.onChange} />
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="checkInDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel className="mb-1.5">Data zameldowania</FormLabel>
                            <DatePicker value={field.value} onChange={field.onChange} />
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                    control={form.control}
                    name="checkOutDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="mb-1.5">Data wymeldowania</FormLabel>
                        <DatePicker value={field.value} onChange={field.onChange} />
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="departureReportDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="mb-1.5">Data zgłoszenia wyjazdu</FormLabel>
                        <DatePicker value={field.value} onChange={field.onChange} />
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Komentarze</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Dodatkowe informacje..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
              </TabsContent>
              <TabsContent value="finance" className="space-y-4 pt-4 px-2 data-[state=active]:animate-in data-[state=active]:fade-in-0">
                 <div className="grid grid-cols-2 gap-4 items-end">
                    <FormField
                        control={form.control}
                        name="depositReturned"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Zwrot kaucji</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || 'Nie dotyczy'}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz opcję" />
                                </SelectTrigger>
                                </FormControl>
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
                            <FormLabel>Kwota zwrotu (zł)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0.00" {...field} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>Potrącenia</Label>
                     <FormField
                        control={form.control}
                        name="deductionRegulation"
                        render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                            <FormLabel className="text-sm font-normal text-muted-foreground">Zgodnie z regulaminem (zł)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0.00" {...field} className="w-32" onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} value={field.value ?? ''} />
                            </FormControl>
                            </FormItem>
                        )}
                    />
                      <FormField
                        control={form.control}
                        name="deductionNo4Months"
                        render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                            <FormLabel className="text-sm font-normal text-muted-foreground">Nie przepracowanie 4 miesięcy (zł)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0.00" {...field} className="w-32" onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} value={field.value ?? ''} />
                            </FormControl>
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="deductionNo30Days"
                        render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                            <FormLabel className="text-sm font-normal text-muted-foreground">Nie poinformowanie w ciągu 30 dni (zł)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0.00" {...field} className="w-32" onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} value={field.value ?? ''} />
                            </FormControl>
                            </FormItem>
                        )}
                    />
                 </div>
                <FormItem>
                    <div className="mb-4">
                        <FormLabel>Potrącenie za co</FormLabel>
                    </div>
                    <div className="space-y-4">
                        {fields.map((item, index) => (
                            <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border p-3 rounded-md">
                                <FormField
                                    control={form.control}
                                    name={`deductionReason.${index}.checked`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal w-40 sm:w-auto">
                                                {item.name}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`deductionReason.${index}.amount`}
                                    render={({ field }) => (
                                        <FormItem className="w-full sm:w-auto flex-grow sm:flex-grow-0">
                                            <FormControl>
                                                <div className="relative">
                                                     <Input 
                                                        type="number" 
                                                        placeholder="Suma" 
                                                        {...field}
                                                        disabled={!watchedDeductionReasons?.[index]?.checked}
                                                        className="w-full sm:w-32" 
                                                        onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} 
                                                        value={field.value ?? ''}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">zł</span>
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        ))}
                    </div>
                </FormItem>
              </TabsContent>
              </div>
            </Tabs>
            <DialogFooter className="mt-4 shrink-0 px-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={form.formState.isSubmitting}>Anuluj</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting} className="transition-all active:scale-95">
                {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Zapisywanie...</> : 'Zapisz'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
