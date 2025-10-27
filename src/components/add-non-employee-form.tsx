
// This component provides a form for adding or editing non-employee residents.

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
import type { NonEmployee, Settings } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  fullName: z.string().min(3, "Imię i nazwisko musi mieć co najmniej 3 znaki."),
  address: z.string().min(1, "Adres jest wymagany."),
  roomNumber: z.string().min(1, "Numer pokoju jest wymagany."),
  checkInDate: z.date({ required_error: "Data zameldowania jest wymagana." }),
  checkOutDate: z.date().nullable().optional(),
  comments: z.string().optional(),
});

type NonEmployeeFormData = Omit<z.infer<typeof formSchema>, 'checkInDate' | 'checkOutDate'> & {
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
          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: NonEmployeeFormData) => void;
  settings: Settings;
  nonEmployee: NonEmployee | null;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      address: '',
      roomNumber: '',
      checkInDate: undefined,
      checkOutDate: null,
      comments: '',
    },
  });

  const selectedAddress = form.watch('address');
  const availableRooms = settings.addresses.find(a => a.name === selectedAddress)?.rooms || [];

  useEffect(() => {
    if (nonEmployee) {
      form.reset({
        ...nonEmployee,
        checkInDate: parseDate(nonEmployee.checkInDate),
        checkOutDate: parseDate(nonEmployee.checkOutDate),
      });
    } else {
      form.reset({
        fullName: '',
        address: '',
        roomNumber: '',
        checkInDate: new Date(),
        checkOutDate: null,
        comments: '',
      });
    }
  }, [nonEmployee, isOpen, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const formatDate = (date: Date | null | undefined): string | null | undefined => {
        if (!date) return date;
        return format(date, 'yyyy-MM-dd');
    }

    const formData: NonEmployeeFormData = {
      ...values,
      checkInDate: formatDate(values.checkInDate)!,
      checkOutDate: formatDate(values.checkOutDate),
    };

    onSave(formData);
    onOpenChange(false);
  };
  
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
