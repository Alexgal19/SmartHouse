
"use client";

import type { Settings, HousingAddress, Coordinator, Room, Employee } from "@/types";
import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, PlusCircle, Trash2, ShieldCheck, KeyRound, Upload, FileWarning } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { transferEmployees } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";


interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  allEmployees: Employee[];
  currentUser: Coordinator;
  onDataRefresh: () => void;
  onBulkImport: (fileData: ArrayBuffer) => Promise<{success: boolean, message: string}>;
}

const EmployeeImportDialog = ({ isOpen, onOpenChange, onImport }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void, onImport: (fileData: ArrayBuffer) => Promise<{success: boolean, message: string}> }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleImportClick = async () => {
        if (!file) {
            toast({ variant: 'destructive', title: "Brak pliku", description: "Proszę wybrać plik do importu." });
            return;
        }
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target?.result) {
                const result = await onImport(event.target.result as ArrayBuffer);
                setIsProcessing(false);

                if (result.success) {
                    toast({ title: "Sukces", description: result.message });
                    onOpenChange(false);
                } else {
                    toast({ 
                        variant: 'destructive', 
                        title: "Błąd importu", 
                        description: <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4"><code className="text-white">{result.message}</code></pre>,
                        duration: 15000
                    });
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
         <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                setFile(null);
            }
            onOpenChange(open);
        }}>
            <DialogContent className="max-w-xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Importuj pracowników z Excel</DialogTitle>
                    <DialogDescription>
                        Wybierz plik .xlsx lub .xls. Upewnij się, że plik ma poprawną strukturę.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                     <Alert>
                        <FileWarning className="h-4 w-4" />
                        <AlertTitle>Wymagane Kolumny</AlertTitle>
                        <AlertDescription>
                            <code className="text-xs bg-muted p-1 rounded-md">fullName, coordinatorName, nationality, gender, address, roomNumber, zaklad, checkInDate</code>
                            <p className="text-xs mt-1">Opcjonalne: <code className="text-xs bg-muted p-1 rounded-md">contractStartDate, contractEndDate, departureReportDate, comments</code></p>
                        </AlertDescription>
                    </Alert>
                    <div className="p-4 border-2 border-dashed rounded-lg text-center">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                           <Upload className="mr-2 h-4 w-4" /> Wybierz plik
                        </Button>
                        {file && <p className="text-sm text-muted-foreground mt-2">{file.name}</p>}
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary" type="button">Anuluj</Button></DialogClose>
                    <Button onClick={handleImportClick} disabled={!file || isProcessing}>
                        {isProcessing ? 'Importowanie...' : `Importuj`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

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
    const [roomsText, setRoomsText] = useState('');
    const { toast } = useToast();

    const openEditDialog = (address: HousingAddress) => {
        setCurrentAddress(address);
        setRoomsText(address.rooms.map(r => `${r.name}: ${r.capacity}`).join('\n'));
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

        const newRooms: Room[] = [];
        const lines = roomsText.split('\n').filter(line => line.trim() !== '');
        const roomNames = new Set<string>();

        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length !== 2) {
                toast({ variant: 'destructive', title: 'Błąd formatu', description: `Nieprawidłowy format w linii: "${line}". Użyj formatu "Nazwa: Ilość".`});
                return;
            }
            const name = parts[0].trim();
            const capacity = parseInt(parts[1].trim(), 10);

            if (!name) {
                toast({ variant: 'destructive', title: 'Błąd formatu', description: `Nazwa pokoju nie może być pusta w linii: "${line}".`});
                return;
            }
            if (isNaN(capacity) || capacity < 0) {
                toast({ variant: 'destructive', title: 'Błąd formatu', description: `Nieprawidłowa ilość miejsc w linii: "${line}".`});
                return;
            }
            if (roomNames.has(name.toLowerCase())) {
                 toast({ variant: 'destructive', title: 'Zduplikowana nazwa', description: `Nazwa pokoju "${name}" jest użyta więcej niż raz.`});
                return;
            }
            
            roomNames.add(name.toLowerCase());
            
            const existingRoom = currentAddress.rooms.find(r => r.name.toLowerCase() === name.toLowerCase());
            newRooms.push({
                id: existingRoom?.id || `room-${Date.now()}-${Math.random()}`,
                name: name,
                capacity: capacity
            });
        }
        
        const updatedAddress = { ...currentAddress, rooms: newRooms };
        const newItems = items.map(item => item.id === updatedAddress.id ? updatedAddress : item);
        
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
                         <div className="space-y-2">
                            <Label htmlFor="rooms">Pokoje</Label>
                             <Textarea
                                id="rooms"
                                value={roomsText}
                                onChange={(e) => setRoomsText(e.target.value)}
                                placeholder="1A: 4&#10;1B: 2&#10;Pokój 3: 3"
                                className="h-64 font-mono text-sm"
                            />
                            <DialogDescription className="text-xs">
                                Wprowadź każdą кімнату w nowym wierszu w formacie "Nazwa: Ilość miejsc".
                            </DialogDescription>
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


export default function SettingsView({ settings, onUpdateSettings, allEmployees, currentUser, onDataRefresh, onBulkImport }: SettingsViewProps) {
  const { isMobile } = useIsMobile();
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Ustawienia Aplikacji</CardTitle>
            <div className="flex gap-2">
                <Button onClick={() => setIsImportOpen(true)} variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Importuj
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="addresses" className="w-full" orientation={isMobile ? "vertical" : "horizontal"}>
          <TabsList className={cn("flex-wrap h-auto sm:h-10",isMobile ? "flex-col items-stretch" : "grid w-full grid-cols-5")}>
            <TabsTrigger value="addresses">Adresy</TabsTrigger>
            <TabsTrigger value="nationalities">Narodowości</TabsTrigger>
            <TabsTrigger value="genders">Płeć</TabsTrigger>
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
            <TabsContent value="genders" className="mt-0">
               <ListManager title="Płeć" items={settings.genders} onUpdate={(newGenders) => onUpdateSettings({ genders: newGenders })} />
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
      <EmployeeImportDialog 
        isOpen={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        onImport={onBulkImport}
      />
    </Card>
  );
}

    