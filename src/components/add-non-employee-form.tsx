
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
import type { NonEmployee, Settings, SessionData } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';

const formSchema = z.object({
  fullName: z.string().min(3, "Imię i nazwisko musi mieć co najmniej 3 znaki."),
  locality: z.string().min(1, "Miejscowość jest wymagana."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Numer pokoju jest wymagany."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }),
  checkOutDate: z.date().nullable().optional(),
  comments: z.string().optional(),
});

type NonEmployeeFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate' | 'locality'> & {
  checkInDate: string;
  checkOutDate?: string | null;
};

const parseDate = (dateString: string | null | undefined): Date | undefined => {
    if (!dateString) return undefined;
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? undefined : date;
};

const DateInput = ({
  value,
  onChange,
  disabled,
}: {
  value?: Date | null;
  onChange: (date?: Date) => void;
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
    const parsedDate = parse(e.target.value, 'dd-MM-yyyy', new Date());
    if (!isNaN(parsedDate.getTime())) {
      onChange(parsedDate);
    }
  };

  const handleDateSelect = (date?: Date) => {
    if (date) {
      onChange(date);
      setInputValue(format(date, 'dd-MM-yyyy'));
      setIsPopoverOpen(false);
    } else {
      onChange(undefined);
      setInputValue('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDateSelect(undefined);
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
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

export function AddNonEmployeeForm({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  nonEmployee,
  currentUser,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: NonEmployeeFormData) => void;
  settings: Settings;
  nonEmployee: NonEmployee | null;
  currentUser: SessionData;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      locality: '',
      address: '',
      roomNumber: '',
      checkInDate: undefined,
      checkOutDate: null,
      comments: '',
    },
  });

  const selectedLocality = form.watch('locality');
  const selectedAddress = form.watch('address');

  const availableAddresses = useMemo(() => {
    if (!settings) return [];
    
    let userAddresses = settings.addresses;
    if (!currentUser.isAdmin) {
        userAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(currentUser.uid));
    }
    if (!selectedLocality) return userAddresses;

    const filtered = userAddresses.filter(a => a.locality === selectedLocality);
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [settings, selectedLocality, currentUser]);

  const availableRooms = useMemo(() => {
    const rooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];
    return [...rooms].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [settings.addresses, selectedAddress]);

  const availableLocalities = useMemo(() => {
    if (!settings) return [];
    let userAddresses = settings.addresses;
     if (!currentUser.isAdmin) {
        userAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(currentUser.uid));
    }
    const localities = [...new Set(userAddresses.map(a => a.locality))];
    return localities.sort((a,b) => a.localeCompare(b));
  }, [settings, currentUser]);

  useEffect(() => {
    if (nonEmployee) {
        const neAddress = settings.addresses.find(a => a.name === nonEmployee.address);
        const neLocality = neAddress ? neAddress.locality : '';
      form.reset({
        ...nonEmployee,
        locality: neLocality,
        checkInDate: parseDate(nonEmployee.checkInDate),
        checkOutDate: parseDate(nonEmployee.checkOutDate),
      });
    } else {
      form.reset({
        fullName: '',
        locality: '',
        address: '',
        roomNumber: '',
        checkInDate: new Date(),
        checkOutDate: null,
        comments: '',
      });
    }
  }, [nonEmployee, isOpen, form, settings.addresses]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const formatDate = (date: Date | null | undefined): string | null | undefined => {
        if (!date) return date;
        return format(date, 'yyyy-MM-dd');
    }
    
    const { locality, ...restOfValues } = values;

    const formData: NonEmployeeFormData = {
      ...restOfValues,
      checkInDate: formatDate(values.checkInDate)!,
      checkOutDate: formatDate(values.checkOutDate),
    };

    onSave(formData);
    onOpenChange(false);
  };
  
  const handleLocalityChange = (value: string) => {
    form.setValue('locality', value);
    form.setValue('address', '');
    form.setValue('roomNumber', '');
  }

  const handleAddressChange = (value: string) => {
    form.setValue('address', value);
    form.setValue('roomNumber', '');
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DialogHeader>
          <DialogTitle>{nonEmployee ? 'Edytuj dane mieszkańca (NZ)' : 'Dodaj nowego mieszkańca (NZ)'}</DialogTitle>
          <DialogDescription>
            Wypełnij poniższe pola, aby {nonEmployee ? 'zaktualizować' : 'dodać'} mieszkańca.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[65vh] p-1">
                <div className="space-y-4 px-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imię i nazwisko</FormLabel>
                        <FormControl><Input placeholder="Anna Nowak" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="locality"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Miejscowość</FormLabel>
                            <Select onValueChange={handleLocalityChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Wybierz miejscowość" /></SelectTrigger></FormControl>
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="checkInDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Data zameldowania</FormLabel>
                                <DateInput 
                                    value={field.value} 
                                    onChange={field.onChange}
                                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
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
