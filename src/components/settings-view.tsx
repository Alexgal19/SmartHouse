
"use client";

import type { Settings, HousingAddress, Coordinator, Room, Employee } from "@/types";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, PlusCircle, Trash2, ShieldCheck, KeyRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { transferEmployees, getEmployees } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";


interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  allEmployees: Employee[];
  currentUser: Coordinator;
  onDataRefresh: () => void;
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
    const [newAddressName, setNewAddressName] = useState('');
    const [currentAddress, setCurrentAddress] = useState<HousingAddress | null>(null);

    const openEditDialog = (address: HousingAddress) => {
        setCurrentAddress(JSON.parse(JSON.stringify(address))); // Deep copy
        setIsEditDialogOpen(true);
    };

    const handleAdd = () => {
        const names = newAddressName.split('\n').map(name => name.trim()).filter(Boolean);
        if (names.length > 0) {
            const addressesToAdd: HousingAddress[] = names.map(name => ({
                id: `addr-${Date.now()}-${Math.random()}`,
                name,
                rooms: [],
            }));
            onUpdate([...items, ...addressesToAdd]);
            setNewAddressName('');
            setIsAddDialogOpen(false);
        }
    };
    
    const handleSaveEdit = () => {
        if (!currentAddress) return;
        const newItems = items.map(item => item.id === currentAddress.id ? currentAddress : item);
        onUpdate(newItems);
        setIsEditDialogOpen(false);
    };

    const handleDelete = (id: string) => {
        onUpdate(items.filter(item => item.id !== id));
    };

    const handleRoomChange = (roomId: string, field: keyof Room, value: string | number) => {
        if (!currentAddress) return;
        const updatedRooms = currentAddress.rooms.map(room => 
            room.id === roomId ? { ...room, [field]: value } : room
        );
        setCurrentAddress({ ...currentAddress, rooms: updatedRooms });
    };

    const addRoom = () => {
        if (!currentAddress) return;
        const newRoom: Room = {
            id: `room-${Date.now()}-${Math.random()}`,
            name: '',
            capacity: 0,
        };
        setCurrentAddress({ ...currentAddress, rooms: [...currentAddress.rooms, newRoom] });
    };

    const deleteRoom = (roomId: string) => {
        if (!currentAddress) return;
        setCurrentAddress({ ...currentAddress, rooms: currentAddress.rooms.filter(r => r.id !== roomId) });
    };
    
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Adresy</CardTitle>
                <Button size="sm" onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Dodaj Adresy</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {items.map(address => {
                        const totalCapacity = address.rooms.reduce((acc, room) => acc + room.capacity, 0);
                        return (
                            <Card key={address.id} className="bg-muted/50">
                                <CardHeader className="flex-row items-center justify-between p-4">
                                    <div>
                                        <p className="font-semibold">{address.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Pojemność: {totalCapacity} | Pokoje: {address.rooms.length}
                                        </p>
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
                        )
                    })}
                </div>
            </CardContent>
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Dodaj nowe adresy</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="newAddresses">Adresy (każdy w nowej linii)</Label>
                        <Textarea id="newAddresses" value={newAddressName} onChange={(e) => setNewAddressName(e.target.value)} placeholder="ul. Słoneczna 1, Warszawa\nul. Leśna 2, Kraków" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleAdd}>Dodaj</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edytuj adres</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Adres</Label>
                            <Input id="name" value={currentAddress?.name || ''} onChange={(e) => setCurrentAddress(p => p ? {...p, name: e.target.value} : null)} />
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium">Pokoje</h4>
                                <Button size="sm" variant="outline" onClick={addRoom}>
                                    <PlusCircle className="mr-2 h-4 w-4"/>
                                    Dodaj pokój
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {currentAddress?.rooms.map(room => (
                                    <div key={room.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                                        <div className="flex-1 space-y-2">
                                            <Label htmlFor={`room-name-${room.id}`}>Nazwa pokoju</Label>
                                            <Input id={`room-name-${room.id}`} value={room.name} placeholder="Np. 1A" onChange={(e) => handleRoomChange(room.id, 'name', e.target.value)} />
                                        </div>
                                        <div className="w-24 space-y-2">
                                            <Label htmlFor={`room-capacity-${room.id}`}>Miejsca</Label>
                                            <Input id={`room-capacity-${room.id}`} type="number" value={room.capacity} onChange={(e) => handleRoomChange(room.id, 'capacity', parseInt(e.target.value, 10) || 0)} />
                                        </div>
                                        <Button variant="ghost" size="icon" className="self-end" onClick={() => deleteRoom(room.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                 {currentAddress?.rooms.length === 0 && (
                                    <p className="text-sm text-center text-muted-foreground py-4">Brak pokoi. Dodaj pierwszy pokój.</p>
                                 )}
                            </div>
                        </div>
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
const CoordinatorManager = ({ items, onUpdate, allEmployees, currentUser, onDataRefresh }: { items: Coordinator[]; onUpdate: (newItems: Coordinator[]) => void; allEmployees: Employee[]; currentUser: Coordinator; onDataRefresh: () => void; }) => {
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
    
    const [newCoordinators, setNewCoordinators] = useState('');
    const [currentCoordinator, setCurrentCoordinator] = useState<Partial<Coordinator> | null>(null);
    const [transferToCoordinatorId, setTransferToCoordinatorId] = useState('');

    const openEditDialog = (coordinator: Coordinator) => {
        setCurrentCoordinator({...coordinator});
        setIsEditDialogOpen(true);
    };

     const openTransferDialog = (coordinator: Coordinator) => {
        setCurrentCoordinator(coordinator);
        setTransferToCoordinatorId('');
        setIsTransferDialogOpen(true);
    };

    const handleAdd = () => {
        const names = newCoordinators.split('\n').map(name => name.trim()).filter(Boolean);
        if (names.length > 0) {
            const coordinatorsToAdd: Coordinator[] = names.map(name => ({
                uid: `coord-${Date.now()}-${Math.random()}`,
                name,
                isAdmin: false,
                password: '',
            }));
            onUpdate([...items, ...coordinatorsToAdd]);
            setNewCoordinators('');
            setIsAddDialogOpen(false);
        }
    };
    
    const handleSaveEdit = () => {
        if (!currentCoordinator || !currentCoordinator.name || !currentCoordinator.uid) return;
        const newItems = items.map(item => item.uid === currentCoordinator.uid ? currentCoordinator as Coordinator : item);
        onUpdate(newItems);
        setIsEditDialogOpen(false);
    };
    
    const handleResetPassword = (uid: string) => {
        const newItems = items.map(item => item.uid === uid ? { ...item, password: '' } : item);
        onUpdate(newItems);
        toast({ title: "Sukces", description: "Hasło zostało zresetowane. Koordynator będzie mógł ustawić nowe hasło przy następnym logowaniu." });
    };

    const handleDelete = (uid: string) => {
         const employeesCount = allEmployees.filter(e => e.coordinatorId === uid).length;
        if (employeesCount > 0) {
            toast({
                variant: 'destructive',
                title: 'Nie można usunąć koordynatora',
                description: `Ten koordynator ma przypisanych ${employeesCount} pracowników. Najpierw przenieś pracowników do innego koordynatora.`
            });
            return;
        }
        onUpdate(items.filter(item => item.uid !== uid));
    };

     const handleTransfer = async () => {
        if (!currentCoordinator?.uid || !transferToCoordinatorId) {
            toast({ variant: "destructive", title: "Błąd", description: "Proszę wybrać obu koordynatorów." });
            return;
        }

        try {
            await transferEmployees(currentCoordinator.uid, transferToCoordinatorId, currentUser);
            toast({ title: "Sukces", description: "Pracownicy zostali przeniesieni." });
            onDataRefresh();
            setIsTransferDialogOpen(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Nie udało się przenieść pracowników.";
            toast({ variant: "destructive", title: "Błąd", description: message });
        }
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
                                <div className="flex items-center gap-3">
                                    {coordinator.isAdmin && <ShieldCheck className="h-5 w-5 text-primary" />}
                                    <div>
                                        <p className="font-semibold">{coordinator.name}</p>
                                        <p className="text-sm text-muted-foreground font-mono text-xs">{coordinator.uid}</p>
                                        <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                                            <KeyRound className="h-3 w-3" />
                                            <span>{coordinator.password ? 'Hasło ustawione' : 'Brak hasła'}</span>
                                        </div>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => openEditDialog(coordinator)}>Edytuj</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleResetPassword(coordinator.uid)}>Resetuj hasło</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openTransferDialog(coordinator)}>Przenieś pracowników</DropdownMenuItem>
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
                        <div className="space-y-2">
                           <Label htmlFor="name">Imię i Nazwisko</Label>
                           <Input id="name" value={currentCoordinator?.name || ''} onChange={(e) => setCurrentCoordinator(p => p ? { ...p, name: e.target.value } : null)} />
                        </div>
                         <div className="flex items-center space-x-2">
                            <Switch 
                                id="isAdmin" 
                                checked={currentCoordinator?.isAdmin || false} 
                                onCheckedChange={(checked) => setCurrentCoordinator(p => p ? { ...p, isAdmin: checked } : null)}
                            />
                            <Label htmlFor="isAdmin">Administrator</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <Button onClick={handleSaveEdit}>Zapisz</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
             <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Przenieś pracowników</DialogTitle>
                        <DialogDescription>
                            Przeniesienie wszystkich pracowników od {currentCoordinator?.name} do innego koordynatora.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label>Od</Label>
                            <Input value={currentCoordinator?.name || ''} readOnly disabled className="col-span-2" />
                        </div>
                         <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="transferTo">Do</Label>
                            <Select value={transferToCoordinatorId} onValueChange={setTransferToCoordinatorId}>
                                <SelectTrigger className="col-span-2">
                                    <SelectValue placeholder="Wybierz koordynatora docelowego" />
                                </SelectTrigger>
                                <SelectContent>
                                    {items.filter(c => c.uid !== currentCoordinator?.uid).map(c => (
                                        <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <p className="text-sm text-muted-foreground">
                            Liczba pracowników do przeniesienia: {allEmployees.filter(e => e.coordinatorId === currentCoordinator?.uid).length}
                        </p>
                    </div>
                     <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Anuluj</Button></DialogClose>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button disabled={!transferToCoordinatorId}>Przenieś</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Czy na pewno chcesz przenieść?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Ta operacja przypisze wszystkich pracowników od {currentCoordinator?.name} do wybranego koordynatora. Tej akcji nie można cofnąć.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleTransfer}>Potwierdź i przenieś</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};


export default function SettingsView({ settings, onUpdateSettings, allEmployees, currentUser, onDataRefresh }: SettingsViewProps) {
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
               <CoordinatorManager items={settings.coordinators} onUpdate={(newCoordinators) => onUpdateSettings({ coordinators: newCoordinators })} allEmployees={allEmployees} currentUser={currentUser} onDataRefresh={onDataRefresh} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
