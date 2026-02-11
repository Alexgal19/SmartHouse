
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
import type { BokResident, Settings, SessionData } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse, isValid, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';

export const formSchema = z.object({
  role: z.string().min(1, "Rola (Kierowca/Recepcja) jest wymagana."),
  firstName: z.string().min(1, "Imię jest wymagane."),
  lastName: z.string().min(1, "Nazwisko jest wymagane."),
  coordinatorId: z.string().min(1, "Koordynator jest wymagany."),
  nationality: z.string().min(1, "Narodowość jest wymagana."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Pokój jest wymagany."),
  zaklad: z.string().optional(),
  gender: z.string().min(1, "Płeć jest wymagana."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }),
  checkOutDate: z.date().nullable().optional(),
  returnStatus: z.string().optional(),
  status: z.string().optional(),
  comments: z.string().optional(),
});

export type BokResidentFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'coordinatorId'> & {
  checkInDate: string | null;
  checkOutDate?: string | null;
  coordinatorId: string;
};

const parseDate = (dateString: string | null | undefined): Date | undefined => {
    if (!dateString) return undefined;
    const date = parseISO(dateString);
    return isValid(date) ? date : undefined;
};

const DateInput = ({
  value,
  onChange,
  disabled,
  id,
}: {
  value?: Date | null;
  onChange: (date?: Date | null) => void;
  disabled?: (date: Date) => boolean;
  id?: string;
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
            id={id}
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
          onSelect={(d) => handleDateSelect(d ?? null)}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};


export function AddBokResidentForm({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  resident,
  currentUser
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: BokResidentFormData) => void;
  settings: Settings;
  resident: BokResident | null;
  currentUser: SessionData;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: '',
      firstName: '',
      lastName: '',
      coordinatorId: '',
      nationality: '',
      address: '',
      roomNumber: '',
      zaklad: '',
      gender: '',
      checkInDate: new Date(),
      checkOutDate: null,
      returnStatus: '',
      status: '',
      comments: '',
    },
  });
  
  const selectedCoordinatorId = form.watch('coordinatorId');
  const selectedAddress = form.watch('address');

  const availableAddresses = useMemo(() => {
    if (!selectedCoordinatorId) {
        return [...settings.addresses].sort((a, b) => a.name.localeCompare(b.name));
    }
    // Show all addresses for the coordinator
    const filtered = settings.addresses.filter(a =>
        a.coordinatorIds.includes(selectedCoordinatorId)
    );
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.addresses, selectedCoordinatorId]);

  const availableRooms = useMemo(() => {
    const rooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];
    return [...rooms].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [settings.addresses, selectedAddress]);

  const availableDepartments = useMemo(() => {
     // Departments are global usually, but if we want to filter by coordinator's departments:
     if (!selectedCoordinatorId) return settings.departments;
     const coordinator = settings.coordinators.find(c => c.uid === selectedCoordinatorId);
     // If coordinator has specific departments assigned, use them? Or use global list?
     // Existing logic suggests using coordinator's departments if available.
     return coordinator ? [...coordinator.departments].sort((a, b) => a.localeCompare(b)) : settings.departments;
  }, [settings.coordinators, settings.departments, selectedCoordinatorId]);

  useEffect(() => {
    if (resident) {
        form.reset({
            role: resident.role || '',
            firstName: resident.firstName || '',
            lastName: resident.lastName || '',
            coordinatorId: resident.coordinatorId || currentUser.uid,
            nationality: resident.nationality || '',
            address: resident.address || '',
            roomNumber: resident.roomNumber || '',
            zaklad: resident.zaklad || '',
            gender: resident.gender || '',
            checkInDate: parseDate(resident.checkInDate) ?? new Date(),
            checkOutDate: parseDate(resident.checkOutDate) ?? null,
            returnStatus: resident.returnStatus || '',
            status: resident.status || '',
            comments: resident.comments || '',
        });
    } else {
        form.reset({
          role: '',
          firstName: '',
          lastName: '',
          coordinatorId: currentUser.uid || '',
          nationality: '',
          address: '',
          roomNumber: '',
          zaklad: '',
          gender: '',
          checkInDate: new Date(),
          checkOutDate: null,
          returnStatus: '',
          status: '',
          comments: '',
        });
    }
  }, [resident, isOpen, form, settings, currentUser]);


  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const formatDate = (date: Date | null | undefined): string | null => {
        if (!date) return null;
        return format(date, 'yyyy-MM-dd');
    }

    const formData: BokResidentFormData = {
        ...values,
        coordinatorId: values.coordinatorId || '',
        checkInDate: formatDate(values.checkInDate),
        checkOutDate: formatDate(values.checkOutDate),
    };

    onSave(formData);
    onOpenChange(false);
  };
  
  const sortedCoordinators = useMemo(() => {
    return [...settings.coordinators].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.coordinators]);

  const sortedNationalities = useMemo(() => [...settings.nationalities].sort((a, b) => a.localeCompare(b)), [settings.nationalities]);
  const sortedGenders = useMemo(() => [...settings.genders].sort((a, b) => a.localeCompare(b)), [settings.genders]);
  const sortedBokRoles = useMemo(() => [...(settings.bokRoles || [])].sort((a, b) => a.localeCompare(b)), [settings.bokRoles]);
  const sortedBokReturnOptions = useMemo(() => [...(settings.bokReturnOptions || [])].sort((a, b) => a.localeCompare(b)), [settings.bokReturnOptions]);
  const sortedBokStatuses = useMemo(() => [...(settings.bokStatuses || [])].sort((a, b) => a.localeCompare(b)), [settings.bokStatuses]);

  const coordinatorOptions = useMemo(() => sortedCoordinators.map(c => ({ value: c.uid, label: c.name })), [sortedCoordinators]);
  const nationalityOptions = useMemo(() => sortedNationalities.map(n => ({ value: n, label: n })), [sortedNationalities]);
  const departmentOptions = useMemo(() => availableDepartments.map(d => ({ value: d, label: d })), [availableDepartments]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
            <DialogTitle>{resident ? 'Edytuj Mieszkańca BOK' : 'Dodaj Mieszkańca BOK'}</DialogTitle>
            <DialogDescription>
            Wypełnij poniższe pola.
            </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] mt-4 px-2">
                <div className="space-y-4 p-1">
                
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Kierowca-Recepcja</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Wybierz rolę" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {sortedBokRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nazwisko</FormLabel>
                            <FormControl><Input placeholder="Kowalski" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Imię</FormLabel>
                            <FormControl><Input placeholder="Jan" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="coordinatorId"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Koordynator</FormLabel>
                        <FormControl>
                            <Combobox
                                options={coordinatorOptions}
                                value={field.value || ''}
                                onChange={(val) => {
                                    field.onChange(val);
                                    form.setValue('address', '');
                                    form.setValue('roomNumber', '');
                                }}
                                placeholder="Wybierz koordynatora"
                                searchPlaceholder="Szukaj koordynatora..."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="nationality"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Narodowość</FormLabel>
                            <FormControl>
                                <Combobox
                                    options={nationalityOptions}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    placeholder="Wybierz narodowość"
                                    searchPlaceholder="Szukaj narodowości..."
                                />
                            </FormControl>
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
                            <Select onValueChange={field.onChange} value={field.value || ''}>
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
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Adres</FormLabel>
                            <Select onValueChange={(val) => {
                                field.onChange(val);
                                form.setValue('roomNumber', '');
                            }} value={field.value || ''}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Wybierz adres" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {availableAddresses.map(a => (
                                        <SelectItem key={a.id} value={a.name} disabled={!a.isActive}>
                                            {a.name} {!a.isActive ? '(Niedostępny)' : ''}
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
                        name="roomNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pokój</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedAddress}>
                            <FormControl><SelectTrigger><SelectValue placeholder={!selectedAddress ? "Najpierw wybierz adres" : "Wybierz pokój"} /></SelectTrigger></FormControl>
                            <SelectContent>
                                {availableRooms.map(r => (
                                    <SelectItem key={r.id} value={r.name} disabled={!r.isActive}>
                                        {r.name} {r.isActive ? `(Pojemność: ${r.capacity})` : '(Niedostępny)'}
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
                     name="zaklad"
                     render={({ field }) => (
                     <FormItem className="flex flex-col">
                         <div className="flex justify-between items-center">
                             <FormLabel>Zakład</FormLabel>
                             {field.value && (
                                 <Button
                                     type="button"
                                     variant="ghost"
                                     size="sm"
                                     className="h-6 w-6 p-0 hover:bg-transparent"
                                     onClick={() => field.onChange('')}
                                 >
                                     <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                     <span className="sr-only">Wyczyść</span>
                                 </Button>
                             )}
                         </div>
                         <FormControl>
                             <Combobox
                                 options={departmentOptions}
                                 value={field.value || ''}
                                 onChange={field.onChange}
                                 placeholder="Wybierz zakład"
                                 searchPlaceholder="Szukaj zakładu..."
                             />
                         </FormControl>
                         <FormMessage />
                     </FormItem>
                     )}
                 />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="checkInDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Data zameldowania</FormLabel>
                                <FormControl>
                                    <DateInput
                                        value={field.value ?? undefined}
                                        onChange={field.onChange}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                        control={form.control}
                        name="checkOutDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Data wyjazdu</FormLabel>
                                <FormControl>
                                    <DateInput value={field.value ?? undefined} onChange={field.onChange} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="returnStatus"
                        render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel>Powrót</FormLabel>
                                {field.value && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-transparent"
                                        onClick={() => field.onChange('')}
                                    >
                                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                        <span className="sr-only">Wyczyść</span>
                                    </Button>
                                )}
                            </div>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Wybierz opcję" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {sortedBokReturnOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel>Status</FormLabel>
                                {field.value && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-transparent"
                                        onClick={() => field.onChange('')}
                                    >
                                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                        <span className="sr-only">Wyczyść</span>
                                    </Button>
                                )}
                            </div>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Wybierz status" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {sortedBokStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                            </Select>
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
            </ScrollArea>
            <DialogFooter className="mt-4">
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
