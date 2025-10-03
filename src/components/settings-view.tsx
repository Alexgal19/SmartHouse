"use client";

import type { Settings, HousingAddress, Coordinator } from "@/types";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

// Generic List Manager for simple string arrays
const ListManager = ({ title, items, onUpdate }: { title: string; items: string[]; onUpdate: (newItems: string[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newItems, setNewItems] = useState('');
  
    const handleAdd = () => {
        const itemsToAdd = newItems.split('\n').map(item => item.trim()).filter(Boolean);
        if (itemsToAdd.length > 0) {
            const uniqueNewItems = itemsToAdd.filter(item => !items.includes(item));
            onUpdate([...items, ...uniqueNewItems]);
            setNewItems('');
            setIsDialogOpen(false);
        }
    };
  
    const handleDelete = (itemToDelete: string) => {
      onUpdate(items.filter(item => item !== itemToDelete));
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">{title}</CardTitle>
                <Button size="sm" onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Dodaj</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {items.map(item => (
                        <Card key={item} className="bg-muted/50">
                            <div className="flex items-center justify-between p-3">
                                <span className="text-sm font-medium">{item}</span>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </CardContent>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodaj nowe pozycje do: {title}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="newItems">Nazwy (każda w nowej linii)</Label>
                        <Textarea id="newItems" value={newItems} onChange={(e) => setNewItems(e.target.value)} placeholder="Pozycja 1\nPozycja 2\nPozycja 3" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleAdd}>Dodaj</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};


// Specific Manager for Addresses (HousingAddress[])
const AddressManager = ({ items, onUpdate }: { items: HousingAddress[]; onUpdate: (newItems: HousingAddress[]) => void }) => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [newAddresses, setNewAddresses] = useState('');
    const [currentAddress, setCurrentAddress] = useState<Partial<HousingAddress> | null>(null);

    const openEditDialog = (address: Partial<HousingAddress>) => {
        setCurrentAddress(address);
        setIsEditDialogOpen(true);
    };

    const handleAdd = () => {
        const lines = newAddresses.split('\n').filter(Boolean);
        const addressesToAdd: HousingAddress[] = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            const name = parts[0];
            const capacity = parts.length > 1 ? parseInt(parts[1], 10) : 0;
            return { id: `addr-${Date.now()}-${Math.random()}`, name, capacity: isNaN(capacity) ? 0 : capacity };
        }).filter(a => a.name);

        if (addressesToAdd.length > 0) {
            onUpdate([...items, ...addressesToAdd]);
            setNewAddresses('');
            setIsAddDialogOpen(false);
        }
    };

    const handleSaveEdit = () => {
        if (!currentAddress || !currentAddress.name) return;
        const newItems = items.map(item => item.id === currentAddress.id ? { ...item, ...currentAddress } as HousingAddress : item);
        onUpdate(newItems);
        setIsEditDialogOpen(false);
    };

    const handleDelete = (id: string) => {
        onUpdate(items.filter(item => item.id !== id));
    };
    
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Adresy</CardTitle>
                <Button size="sm" onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Dodaj Adresy</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {items.map(address => (
                        <Card key={address.id} className="bg-muted/50">
                            <CardHeader className="flex-row items-center justify-between p-4">
                                <div>
                                    <p className="font-semibold">{address.name}</p>
                                    <p className="text-sm text-muted-foreground">Pojemność: {address.capacity}</p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => openEditDialog(address)}>Edytuj</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(address.id)} className="text-destructive">Usuń</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </CardContent>
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Dodaj nowe adresy</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="newAddresses">Adresy (każdy w nowej linii)</Label>
                        <Textarea id="newAddresses" value={newAddresses} onChange={(e) => setNewAddresses(e.target.value)} placeholder="ul. Słoneczna 1, Warszawa, 10\nul. Leśna 2, Kraków, 8" />
                        <p className="text-xs text-muted-foreground">Format: Nazwa Adresu, Pojemność</p>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleAdd}>Dodaj</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edytuj adres</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="name">Adres</Label>
                        <Input id="name" value={currentAddress?.name || ''} onChange={(e) => setCurrentAddress(p => ({...p, name: e.target.value}))} />
                        <Label htmlFor="capacity">Pojemność</Label>
                        <Input id="capacity" type="number" value={currentAddress?.capacity || ''} onChange={(e) => setCurrentAddress(p => ({...p, capacity: parseInt(e.target.value, 10) || 0}))} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleSaveEdit}>Zapisz</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

// Specific Manager for Coordinators
const CoordinatorManager = ({ items, onUpdate }: { items: Coordinator[]; onUpdate: (newItems: Coordinator[]) => void }) => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [newCoordinators, setNewCoordinators] = useState('');
    const [currentCoordinator, setCurrentCoordinator] = useState<Partial<Coordinator> | null>(null);

    const openEditDialog = (coordinator: Partial<Coordinator>) => {
        setCurrentCoordinator(coordinator);
        setIsEditDialogOpen(true);
    };

    const handleAdd = () => {
        const names = newCoordinators.split('\n').map(name => name.trim()).filter(Boolean);
        if (names.length > 0) {
            const coordinatorsToAdd: Coordinator[] = names.map(name => ({
                uid: `coord-${Date.now()}-${Math.random()}`,
                name,
            }));
            onUpdate([...items, ...coordinatorsToAdd]);
            setNewCoordinators('');
            setIsAddDialogOpen(false);
        }
    };
    
    const handleSaveEdit = () => {
        if (!currentCoordinator || !currentCoordinator.name) return;
        const newItems = items.map(item => item.uid === currentCoordinator.uid ? { ...item, ...currentCoordinator } as Coordinator : item);
        onUpdate(newItems);
        setIsEditDialogOpen(false);
    };

    const handleDelete = (uid: string) => {
        onUpdate(items.filter(item => item.uid !== uid));
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Koordynatorzy</CardTitle>
                <Button size="sm" onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Dodaj</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {items.map(coordinator => (
                        <Card key={coordinator.uid} className="bg-muted/50">
                             <CardHeader className="flex-row items-center justify-between p-4">
                                <div>
                                    <p className="font-semibold">{coordinator.name}</p>
                                    <p className="text-sm text-muted-foreground font-mono text-xs">{coordinator.uid}</p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => openEditDialog(coordinator)}>Edytuj</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(coordinator.uid)} className="text-destructive">Usuń</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </CardContent>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodaj nowych koordynatorów</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="newCoordinators">Imiona i Nazwiska (każde w nowej linii)</Label>
                        <Textarea id="newCoordinators" value={newCoordinators} onChange={(e) => setNewCoordinators(e.target.value)} placeholder="Jan Kowalski\nAnna Nowak" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleAdd}>Dodaj</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edytuj koordynatora</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="name">Imię i Nazwisko</Label>
                        <Input id="name" value={currentCoordinator?.name || ''} onChange={(e) => setCurrentCoordinator(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleSaveEdit}>Zapisz</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};


export default function SettingsView({ settings, onUpdateSettings }: SettingsViewProps) {
  const { isMobile } = useIsMobile();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ustawienia Aplikacji</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="addresses" className="w-full" orientation={isMobile ? "vertical" : "horizontal"}>
          <TabsList className={cn("flex-wrap h-auto sm:h-10",isMobile ? "flex-col items-stretch" : "grid w-full grid-cols-4")}>
            <TabsTrigger value="addresses">Adresy</TabsTrigger>
            <TabsTrigger value="nationalities">Narodowości</TabsTrigger>
            <TabsTrigger value="departments">Zakłady</TabsTrigger>
            <TabsTrigger value="coordinators">Koordynatorzy</TabsTrigger>
          </TabsList>
          <div className={cn(isMobile ? "mt-4" : "mt-6")}>
            <TabsContent value="addresses" className="mt-0">
              <AddressManager items={settings.addresses} onUpdate={(newAddresses) => onUpdateSettings({ addresses: newAddresses })} />
            </TabsContent>
            <TabsContent value="nationalities" className="mt-0">
               <ListManager title="Narodowości" items={settings.nationalities} onUpdate={(newNationalities) => onUpdateSettings({ nationalities: newNationalities })} />
            </TabsContent>
            <TabsContent value="departments" className="mt-0">
               <ListManager title="Zakłady" items={settings.departments} onUpdate={(newDepartments) => onUpdateSettings({ departments: newDepartments })} />
            </TabsContent>
            <TabsContent value="coordinators" className="mt-0">
               <CoordinatorManager items={settings.coordinators} onUpdate={(newCoordinators) => onUpdateSettings({ coordinators: newCoordinators })} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
