
"use client";

import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import type { Address, Coordinator } from '@/types';
import { PlusCircle, Trash2 } from 'lucide-react';


const roomSchema = z.object({
  id: z.string().min(1, 'ID pokoju jest wymagane.'),
  name: z.string().min(1, 'Nazwa pokoju jest wymagana.'),
  capacity: z.coerce.number().min(1, 'Pojemność musi być większa od 0.'),
});

const addressSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nazwa adresu jest wymagana.'),
  coordinatorId: z.string().min(1, 'Koordynator jest wymagany.'),
  rooms: z.array(roomSchema),
});


export function AddressForm({
  isOpen,
  onOpenChange,
  onSave,
  coordinators,
  address,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Address) => void;
  coordinators: Coordinator[];
  address: Address | null;
}) {
  const form = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'rooms',
  });

  useEffect(() => {
    if (address) {
        form.reset(address);
    } else {
        form.reset({
            id: `addr-${Date.now()}`,
            name: '',
            coordinatorId: '',
            rooms: [],
        });
    }
  }, [address, isOpen, form]);
  
  const onSubmit = (values: z.infer<typeof addressSchema>) => {
    onSave(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DialogHeader>
          <DialogTitle>{address?.name ? 'Edytuj adres' : 'Dodaj nowy adres'}</DialogTitle>
          <DialogDescription>
            Wypełnij poniższe pola, aby {address?.name ? 'zaktualizować' : 'dodać'} adres i zarządzać pokojami.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] -mr-6 pr-6">
                <div className="space-y-4 p-1">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nazwa adresu</FormLabel>
                            <FormControl><Input placeholder="np. ul. Słoneczna 5, 00-123 Warszawa" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="coordinatorId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Przypisany koordynator</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Wybierz koordynatora" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {coordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>)}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <div className="space-y-2 rounded-md border p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium">Pokoje</h3>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `room-${Date.now()}`, name: '', capacity: 1 })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Dodaj pokój
                            </Button>
                        </div>
                        {fields.map((field, index) => (
                           <div key={field.id} className="flex items-start gap-2">
                                <FormField
                                    control={form.control}
                                    name={`rooms.${index}.name`}
                                    render={({ field: nameField }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel className="sr-only">Nazwa pokoju</FormLabel>
                                            <FormControl><Input placeholder="Nazwa pokoju" {...nameField} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`rooms.${index}.capacity`}
                                    render={({ field: capacityField }) => (
                                        <FormItem className="w-28">
                                             <FormLabel className="sr-only">Pojemność</FormLabel>
                                            <FormControl><Input type="number" placeholder="Pojemność" {...capacityField} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Brak pokoi dla tego adresu.</p>}
                    </div>

                </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4 -mb-6 -mx-6">
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
