
"use client";

import React, { useState, useMemo } from 'react';
import type { EquipmentItem, Settings } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, SlidersHorizontal, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from './ui/skeleton';

interface EquipmentViewProps {
    equipment: EquipmentItem[];
    settings: Settings;
    onAddEquipment: (data: Omit<EquipmentItem, 'id'>) => Promise<void>;
    onUpdateEquipment: (id: string, data: Partial<EquipmentItem>) => Promise<void>;
    onDeleteEquipment: (id: string) => Promise<void>;
}

const equipmentSchema = z.object({
    inventoryNumber: z.string().min(1, "Numer inwentarzowy jest wymagany."),
    name: z.string().min(1, "Nazwa jest wymagana."),
    quantity: z.coerce.number().min(1, "Ilość musi być większa niż 0."),
    description: z.string().optional(),
    addressId: z.string().min(1, "Adres jest wymagany."),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

const EquipmentForm = ({
    isOpen,
    onOpenChange,
    onSave,
    settings,
    editingItem,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: EquipmentFormData, id?: string) => Promise<void>;
    settings: Settings;
    editingItem: EquipmentItem | null;
}) => {
    const form = useForm<EquipmentFormData>({
        resolver: zodResolver(equipmentSchema),
        defaultValues: {
            inventoryNumber: '',
            name: '',
            quantity: 1,
            description: '',
            addressId: '',
        }
    });

    React.useEffect(() => {
        if (isOpen) {
            if (editingItem) {
                form.reset({
                    ...editingItem,
                    quantity: Number(editingItem.quantity)
                });
            } else {
                form.reset({
                    inventoryNumber: '',
                    name: '',
                    quantity: 1,
                    description: '',
                    addressId: '',
                });
            }
        }
    }, [isOpen, editingItem, form]);

    const handleSubmit = async (data: EquipmentFormData) => {
        await onSave(data, editingItem?.id);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                <DialogHeader>
                    <DialogTitle>{editingItem ? "Edytuj wyposażenie" : "Dodaj nowe wyposażenie"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField control={form.control} name="addressId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Adres</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Wybierz adres" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {settings.addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="inventoryNumber" render={({ field }) => (
                            <FormItem><FormLabel>Numer inwentarzowy</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Wyposażenie (Nazwa)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="quantity" render={({ field }) => (
                            <FormItem><FormLabel>Ilość</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Opis</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Anuluj</Button></DialogClose>
                            <Button type="submit">Zapisz</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const EquipmentActions = ({ item, onEdit, onDelete }: { item: EquipmentItem, onEdit: (item: EquipmentItem) => void, onDelete: (id: string) => void }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edytuj
                </DropdownMenuItem>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Usuń
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Czy na pewno chcesz usunąć?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tej operacji nie można cofnąć.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(item.id)} className="bg-destructive hover:bg-destructive/90">
                                Usuń
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const EquipmentTable = ({ items, onEdit, onDelete }: { items: EquipmentItem[], onEdit: (item: EquipmentItem) => void, onDelete: (id: string) => void }) => (
    <div className="border rounded-md overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Adres</TableHead>
                    <TableHead>Nr inwentarzowy</TableHead>
                    <TableHead>Wyposażenie</TableHead>
                    <TableHead>Ilość</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead><span className="sr-only">Akcje</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.length > 0 ? (
                    items.map(item => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.addressName}</TableCell>
                            <TableCell>{item.inventoryNumber}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                            <TableCell>
                                <EquipmentActions item={item} onEdit={onEdit} onDelete={onDelete} />
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">Brak wyposażenia do wyświetlenia.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    </div>
);

const EquipmentCardList = ({ items, onEdit, onDelete }: { items: EquipmentItem[], onEdit: (item: EquipmentItem) => void, onDelete: (id: string) => void }) => (
    <div className="space-y-4">
        {items.length > 0 ? (
            items.map(item => (
                <Card key={item.id} className="animate-in fade-in-0 duration-300">
                    <CardHeader className="flex-row items-start justify-between pb-4">
                        <div>
                            <CardTitle className="text-base">{item.name}</CardTitle>
                            <CardDescription>{item.addressName}</CardDescription>
                        </div>
                        <EquipmentActions item={item} onEdit={onEdit} onDelete={onDelete} />
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <p><span className="font-semibold text-muted-foreground">Nr inwentarzowy:</span> {item.inventoryNumber}</p>
                        <p><span className="font-semibold text-muted-foreground">Ilość:</span> {item.quantity}</p>
                        {item.description && <p><span className="font-semibold text-muted-foreground">Opis:</span> {item.description}</p>}
                    </CardContent>
                </Card>
            ))
        ) : (
            <div className="text-center text-muted-foreground py-8">Brak wyposażenia do wyświetlenia.</div>
        )}
    </div>
);


export default function EquipmentView({ equipment, settings, onAddEquipment, onUpdateEquipment, onDeleteEquipment }: EquipmentViewProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [addressFilter, setAddressFilter] = useState('all');
    const { isMobile, isMounted } = useIsMobile();

    const handleOpenForm = (item: EquipmentItem | null) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const handleSave = async (data: EquipmentFormData, id?: string) => {
        const address = settings.addresses.find(a => a.id === data.addressId);
        if (!address) return;

        const itemData = {
            ...data,
            description: data.description || '',
            addressName: address.name,
        };

        if (id) {
            await onUpdateEquipment(id, itemData);
        } else {
            await onAddEquipment(itemData);
        }
    };
    
    const filteredEquipment = useMemo(() => {
        return equipment.filter(item => {
            const searchMatch = searchTerm === '' || 
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.inventoryNumber.toLowerCase().includes(searchTerm.toLowerCase());
            
            const addressMatch = addressFilter === 'all' || item.addressId === addressFilter;

            return searchMatch && addressMatch;
        });
    }, [equipment, searchTerm, addressFilter]);
    
    const renderContent = () => {
        if (!isMounted) {
            return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
        }
        if (isMobile) {
            return <EquipmentCardList items={filteredEquipment} onEdit={handleOpenForm} onDelete={onDeleteEquipment} />;
        }
        return <EquipmentTable items={filteredEquipment} onEdit={handleOpenForm} onDelete={onDeleteEquipment} />;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Wyposażenie</CardTitle>
                    <Button onClick={() => handleOpenForm(null)}><PlusCircle className="mr-2 h-4 w-4" /> Dodaj</Button>
                </div>
                <CardDescription>Zarządzaj wyposażeniem przypisanym do mieszkań.</CardDescription>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4">
                     <Input
                        placeholder="Szukaj po nazwie lub numerze..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:max-w-xs"
                    />
                     <Select value={addressFilter} onValueChange={setAddressFilter}>
                        <SelectTrigger className="w-full sm:max-w-xs">
                            <SelectValue placeholder="Filtruj po adresie" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie adresy</SelectItem>
                            {settings.addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {(searchTerm || addressFilter !== 'all') && (
                         <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(''); setAddressFilter('all'); }} className="text-muted-foreground self-end sm:self-center">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
            <EquipmentForm 
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSave={handleSave}
                settings={settings}
                editingItem={editingItem}
            />
        </Card>
    );
}
