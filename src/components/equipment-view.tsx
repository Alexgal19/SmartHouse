
// This component manages the view for equipment inventory.
// It allows adding, editing, and deleting equipment items.

"use client";

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMainLayout } from '@/components/main-layout';
import type { EquipmentItem, Settings, SessionData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  inventoryNumber: z.string().min(1, 'Numer inwentarzowy jest wymagany.'),
  name: z.string().min(1, 'Nazwa jest wymagana.'),
  quantity: z.coerce.number().min(1, 'Ilość musi być większa od zera.'),
  description: z.string().optional(),
  addressId: z.string().min(1, 'Adres jest wymagany.'),
});

const EquipmentForm = ({
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
    onSave(values, item?.id);
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


export default function EquipmentView({ currentUser }: { currentUser: SessionData }) {
    const { allEquipment, settings, handleAddEquipment, handleUpdateEquipment, handleDeleteEquipment } = useMainLayout();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
    const [filterAddress, setFilterAddress] = useState('all');

    const handleSave = (data: Omit<EquipmentItem, 'id' | 'addressName'>, id?: string) => {
        const addressName = settings?.addresses.find(a => a.id === data.addressId)?.name || 'Nieznany';
        const itemData = { ...data, addressName };

        if(id) {
            handleUpdateEquipment(id, itemData);
        } else {
            handleAddEquipment(itemData);
        }
        setIsFormOpen(false);
        setEditingItem(null);
    }
    
    const handleAddNew = () => {
        setEditingItem(null);
        setIsFormOpen(true);
    };

    const handleEdit = (item: EquipmentItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const filteredEquipment = useMemo(() => {
        if (!allEquipment) return [];
        if (filterAddress === 'all') return allEquipment;
        return allEquipment.filter(item => item.addressId === filterAddress);
    }, [allEquipment, filterAddress]);

    if (!allEquipment || !settings) {
         return (
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
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Zarządzanie wyposażeniem</CardTitle>
                    <CardDescription>Przeglądaj, dodawaj i edytuj sprzęt na stanie.</CardDescription>
                </div>
                 <div className="flex w-full sm:w-auto items-center gap-2">
                     <Select value={filterAddress} onValueChange={setFilterAddress}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Filtruj wg adresu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie adresy</SelectItem>
                            {settings.addresses.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj
                    </Button>
                 </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nr inw.</TableHead>
                            <TableHead>Nazwa</TableHead>
                            <TableHead>Ilość</TableHead>
                            <TableHead>Adres</TableHead>
                            <TableHead>Opis</TableHead>
                            <TableHead><span className="sr-only">Akcje</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEquipment.length > 0 ? (
                            filteredEquipment.map(item => (
                                <TableRow key={item.id} onClick={() => handleEdit(item)} className="cursor-pointer">
                                    <TableCell>{item.inventoryNumber}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>{item.addressName}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive">
                                                     <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Czy na pewno chcesz usunąć ten sprzęt?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tej operacji nie można cofnąć. Spowoduje to trwałe usunięcie <span className="font-bold">{item.name}</span>.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteEquipment(item.id)}>Usuń</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Brak sprzętu do wyświetlenia.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
             <EquipmentForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSave={handleSave}
                settings={settings}
                item={editingItem}
            />
        </Card>
    )
}
