"use client";

import type { Settings, HousingAddress, Coordinator } from "@/types";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

// Generic List Manager for simple string arrays
const ListManager = ({ title, items, onUpdate }: { title: string; items: string[]; onUpdate: (newItems: string[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newItem, setNewItem] = useState('');
  
    const handleAdd = () => {
      if (newItem.trim()) {
        onUpdate([...items, newItem.trim()]);
        setNewItem('');
        setIsDialogOpen(false);
      }
    };
  
    const handleDelete = (itemToDelete: string) => {
      onUpdate(items.filter(item => item !== itemToDelete));
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{title}</h3>
                <Button onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Dodaj</Button>
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nazwa</TableHead>
                            <TableHead className="text-right">Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item}>
                                <TableCell>{item}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodaj nową pozycję do: {title}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="newItem">Nazwa</Label>
                        <Input id="newItem" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleAdd}>Dodaj</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};


// Specific Manager for Addresses (HousingAddress[])
const AddressManager = ({ items, onUpdate }: { items: HousingAddress[]; onUpdate: (newItems: HousingAddress[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentAddress, setCurrentAddress] = useState<Partial<HousingAddress> | null>(null);

    const openDialog = (address: Partial<HousingAddress> | null = null) => {
        setCurrentAddress(address || { name: '', capacity: 0 });
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!currentAddress || !currentAddress.name) return;
        let newItems;
        if (currentAddress.id) { // Editing
            newItems = items.map(item => item.id === currentAddress.id ? { ...item, ...currentAddress } as HousingAddress : item);
        } else { // Adding
            newItems = [...items, { ...currentAddress, id: `addr-${Date.now()}` } as HousingAddress];
        }
        onUpdate(newItems);
        setIsDialogOpen(false);
    };

    const handleDelete = (id: string) => {
        onUpdate(items.filter(item => item.id !== id));
    };
    
    return (
        <div>
            <div className="flex items-center justify-end mb-4">
                <Button onClick={() => openDialog()}><PlusCircle className="mr-2 h-4 w-4" />Dodaj Adres</Button>
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader><TableRow><TableHead>Adres</TableHead><TableHead>Pojemność</TableHead><TableHead className="text-right">Akcje</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {items.map(address => (
                            <TableRow key={address.id}>
                                <TableCell>{address.name}</TableCell>
                                <TableCell>{address.capacity}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => openDialog(address)}>Edytuj</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(address.id)} className="text-destructive">Usuń</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{currentAddress?.id ? 'Edytuj adres' : 'Dodaj nowy adres'}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="name">Adres</Label>
                        <Input id="name" value={currentAddress?.name || ''} onChange={(e) => setCurrentAddress(p => ({...p, name: e.target.value}))} />
                        <Label htmlFor="capacity">Pojemność</Label>
                        <Input id="capacity" type="number" value={currentAddress?.capacity || ''} onChange={(e) => setCurrentAddress(p => ({...p, capacity: parseInt(e.target.value, 10) || 0}))} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleSave}>Zapisz</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default function SettingsView({ settings, onUpdateSettings }: SettingsViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ustawienia Aplikacji</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="addresses" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="addresses">Adresy</TabsTrigger>
            <TabsTrigger value="nationalities">Narodowości</TabsTrigger>
            <TabsTrigger value="departments">Zakłady</TabsTrigger>
            <TabsTrigger value="coordinators">Koordynatorzy</TabsTrigger>
          </TabsList>
          <TabsContent value="addresses" className="mt-4">
            <AddressManager items={settings.addresses} onUpdate={(newAddresses) => onUpdateSettings({ addresses: newAddresses })} />
          </TabsContent>
          <TabsContent value="nationalities" className="mt-4">
             <ListManager title="Narodowości" items={settings.nationalities} onUpdate={(newNationalities) => onUpdateSettings({ nationalities: newNationalities })} />
          </TabsContent>
          <TabsContent value="departments" className="mt-4">
             <ListManager title="Zakłady" items={settings.departments} onUpdate={(newDepartments) => onUpdateSettings({ departments: newDepartments })} />
          </TabsContent>
          <TabsContent value="coordinators" className="mt-4">
             {/* A dedicated manager for coordinators would be built similarly to AddressManager */}
             <p className="text-muted-foreground text-center p-8">Zarządzanie koordynatorami (w budowie).</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
