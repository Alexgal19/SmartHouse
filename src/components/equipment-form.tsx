
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { EquipmentItem, Settings } from '@/types';

const formSchema = z.object({
  inventoryNumber: z.string().min(1, 'Numer inwentarzowy jest wymagany.'),
  name: z.string().min(1, 'Nazwa jest wymagana.'),
  quantity: z.coerce.number().min(1, 'Ilość musi być większa od zera.'),
  description: z.string().optional(),
  addressId: z.string().min(1, 'Adres jest wymagany.'),
});

export const EquipmentForm = ({
  isOpen,
  onOpenChange,
  onSave,
  settings,
  item,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<EquipmentItem, 'id' | 'addressName'>, id?: string) => void;
  settings: Settings;
  item: EquipmentItem | null;
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inventoryNumber: '',
      name: '',
      quantity: 1,
      description: '',
      addressId: '',
    },
  });

  React.useEffect(() => {
    if (item) {
      form.reset(item);
    } else {
      form.reset({
        inventoryNumber: '',
        name: '',
        quantity: 1,
        description: '',
        addressId: '',
      });
    }
  }, [item, isOpen, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const data: Omit<EquipmentItem, 'id' | 'addressName'> = {
      inventoryNumber: values.inventoryNumber,
      name: values.name,
      quantity: values.quantity,
      description: values.description ?? '',
      addressId: values.addressId,
    };
    onSave(data, item?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edytuj sprzęt' : 'Dodaj nowy sprzęt'}</DialogTitle>
          <DialogDescription>Wypełnij formularz, aby dodać lub zaktualizować sprzęt.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="inventoryNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numer inwentarzowy</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nazwa sprzętu</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ilość</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="addressId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adres</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz adres" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {settings.addresses.map((address) => (
                        <SelectItem key={address.id} value={address.id}>
                          {address.name}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opis (opcjonalnie)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
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
};
