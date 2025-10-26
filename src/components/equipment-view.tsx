
// This component manages the view for equipment inventory.
// It allows adding, editing, and deleting equipment items.

"use client";

import React, { useState, useMemo } from 'react';
import { useMainLayout } from '@/components/main-layout';
import type { EquipmentItem, Settings, SessionData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EquipmentForm } from './equipment-form';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const EquipmentActions = ({ item, onEdit, onDelete }: { item: EquipmentItem, onEdit: (item: EquipmentItem) => void; onDelete: (id: string) => void; }) => {
    return (
        <AlertDialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Otwórz menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(item)}>Edytuj</DropdownMenuItem>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Czy na pewno chcesz usunąć ten sprzęt?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tej operacji не można cofnąć. Spowoduje to trwałe usunięcie <span className="font-bold">{item.name}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDelete(item.id)}>Usuń</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const EquipmentTable = ({ items, onEdit, onDelete }: { items: EquipmentItem[], onEdit: (item: EquipmentItem) => void; onDelete: (id: string) => void; }) => {
    return (
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
                {items.length > 0 ? (
                    items.map(item => (
                        <TableRow key={item.id} onClick={() => onEdit(item)} className="cursor-pointer">
                            <TableCell>{item.inventoryNumber}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.addressName}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                <EquipmentActions item={item} onEdit={onEdit} onDelete={onDelete} />
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
    );
};

const EquipmentCardList = ({ items, onEdit, onDelete }: { items: EquipmentItem[], onEdit: (item: EquipmentItem) => void; onDelete: (id: string) => void; }) => {
    return (
        <div className="space-y-4">
            {items.length > 0 ? (
                items.map(item => (
                    <Card key={item.id} onClick={() => onEdit(item)} className="cursor-pointer">
                         <CardHeader className="flex flex-row items-start justify-between pb-4">
                           <div>
                             <CardTitle className="text-base">{item.name} <span className="text-muted-foreground">({item.quantity} szt.)</span></CardTitle>
                             <CardDescription>
                                {item.addressName}
                             </CardDescription>
                           </div>
                           <div onClick={(e) => e.stopPropagation()}>
                                <EquipmentActions item={item} onEdit={onEdit} onDelete={onDelete} />
                           </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                             <p><span className="font-semibold text-muted-foreground">Nr inw.:</span> {item.inventoryNumber}</p>
                             {item.description && <p><span className="font-semibold text-muted-foreground">Opis:</span> {item.description}</p>}
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center text-muted-foreground py-8">Brak sprzętu do wyświetlenia.</div>
            )}
        </div>
    )
}


export default function EquipmentView({ currentUser }: { currentUser: SessionData }) {
    const { allEquipment, settings, handleAddEquipment, handleUpdateEquipment, handleDeleteEquipment } = useMainLayout();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
    const [filterAddress, setFilterAddress] = useState('all');
    const { isMobile, isMounted } = useIsMobile();

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
    
    const EquipmentListComponent = isMobile ? EquipmentCardList : EquipmentTable;

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
                {isMounted ? (
                    <EquipmentListComponent items={filteredEquipment} onEdit={handleEdit} onDelete={handleDeleteEquipment} />
                ) : (
                     <div className="space-y-4">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                )}
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
