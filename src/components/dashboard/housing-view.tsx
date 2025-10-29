
"use client";

import { useMemo, useState } from 'react';
import type { Employee, NonEmployee, Settings, SessionData } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Bed, Users } from "lucide-react";
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Occupant = Employee | NonEmployee;

type RoomStat = {
    roomNumber: string;
    occupants: Occupant[];
    occupantCount: number;
    capacity: number;
    available: number;
};

type HousingStat = {
    name: string;
    occupants: Occupant[];
    occupantCount: number;
    capacity: number;
    available: number | typeof Infinity;
    rooms: RoomStat[];
};

type SortConfig = {
    key: keyof HousingStat | 'occupancy' | 'capacity';
    direction: 'ascending' | 'descending';
} | null;

export function HousingView({
    employees,
    nonEmployees,
    settings,
    currentUser,
    selectedCoordinatorId,
}: {
    employees: Employee[],
    nonEmployees: NonEmployee[],
    settings: Settings,
    currentUser: SessionData,
    selectedCoordinatorId: string,
}) {
    const [housingSearch, setHousingSearch] = useState('');
    const [sortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
    const [selectedAddress, setSelectedAddress] = useState<HousingStat | null>(null);
    const [isHousingDetailOpen, setIsHousingDetailOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<RoomStat | null>(null);
    const [isRoomDetailOpen, setIsRoomDetailOpen] = useState(false);
    const { copyToClipboard } = useCopyToClipboard();

    const housingStats = useMemo(() => {
        const activeEmployees = employees.filter(e => e.status === 'active');
        const allActiveOccupants = [...activeEmployees, ...nonEmployees];
        
        let addressesToDisplay;

        if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
            addressesToDisplay = settings.addresses;
        } else {
            addressesToDisplay = settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
        }

        const occupiedAddressesNames = new Set(allActiveOccupants.map(o => o.address));
        const allAddressNames = new Set([...addressesToDisplay.map(a => a.name), ...Array.from(occupiedAddressesNames)]);


        return Array.from(allAddressNames).map(addressName => {
            if (!addressName) return null;
            const occupantsInAddress = allActiveOccupants.filter(o => o.address === addressName);
            const addressDetails = settings.addresses.find(a => a.name === addressName);
            const totalCapacity = addressDetails?.rooms.reduce((sum, room) => sum + room.capacity, 0) || 0;
            
            const roomsWithOccupants = (addressDetails?.rooms || []).map(room => {
                const occupantsInRoom = occupantsInAddress.filter(o => o.roomNumber === room.name);
                return {
                    roomNumber: room.name,
                    occupants: occupantsInRoom,
                    occupantCount: occupantsInRoom.length,
                    capacity: room.capacity,
                    available: room.capacity - occupantsInRoom.length,
                };
            }).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

            return {
                name: addressName,
                occupants: occupantsInAddress,
                occupantCount: occupantsInAddress.length,
                capacity: totalCapacity,
                available: totalCapacity > 0 ? totalCapacity - occupantsInAddress.length : Infinity,
                rooms: roomsWithOccupants,
            };
        }).filter((stat): stat is HousingStat => stat !== null);
    }, [employees, nonEmployees, settings, currentUser, selectedCoordinatorId]);

    const sortedAndFilteredHousingStats = useMemo(() => {
        let sortableItems = [...housingStats];

        if (housingSearch) {
            sortableItems = sortableItems.filter(address => address.name.toLowerCase().includes(housingSearch.toLowerCase()));
        }
        
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'occupancy') {
                    aValue = a.capacity > 0 ? (a.occupantCount / a.capacity) * 100 : 0;
                    bValue = b.capacity > 0 ? (b.occupantCount / b.capacity) * 100 : 0;
                } else {
                    aValue = a[sortConfig.key as keyof HousingStat];
                    bValue = b[sortConfig.key as keyof HousingStat];
                }

                if (aValue === Infinity) return 1;
                if (bValue === Infinity) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [housingStats, sortConfig, housingSearch]);

    const getOccupancyColor = (percentage: number) => {
        if (percentage > 100) return "bg-purple-500";
        if (percentage >= 81) return "bg-green-500";
        if (percentage >= 51) return "bg-yellow-500";
        if (percentage > 20) return "bg-orange-500";
        return "bg-red-500";
    };

    const handleCopy = (data: Occupant[]) => {
        const textToCopy = data.map(o => o.fullName).join('\n');
        copyToClipboard(textToCopy, 'Lista skopiowana!');
    };

    const groupedRooms = useMemo(() => {
        if (!selectedAddress) return {};
        return selectedAddress.rooms.reduce((acc, room) => {
          const roomPrefix = room.roomNumber.split('.')[0];
          if (!acc[roomPrefix]) {
            acc[roomPrefix] = {
              capacity: 0,
              rooms: []
            };
          }
          acc[roomPrefix].rooms.push(room);
          acc[roomPrefix].capacity += room.capacity;
          return acc;
        }, {} as Record<string, { capacity: number; rooms: RoomStat[] }>);
    }, [selectedAddress]);

    return (
        <>
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Przegląd zakwaterowania</CardTitle>
                    <CardDescription>Poniżej znajduje się lista wszystkich mieszkań i ich obłożenie.</CardDescription>
                    <div className="pt-2">
                        <Input 
                            placeholder="Szukaj po adresie..." 
                            value={housingSearch}
                            onChange={(e) => setHousingSearch(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh]">
                        <div className="space-y-4 pr-6">
                            {sortedAndFilteredHousingStats.length > 0 ? sortedAndFilteredHousingStats.map((address) => {
                                const occupancyPercentage = address.capacity > 0 ? (address.occupantCount / address.capacity) * 100 : 0;
                                return (
                                    <Card 
                                        key={address.name} 
                                        onClick={() => { setSelectedAddress(address); setIsHousingDetailOpen(true); }} 
                                        className="cursor-pointer transition-all duration-300 hover:shadow-primary/20 hover:shadow-lg hover:scale-[1.02]"
                                    >
                                        <CardHeader>
                                            <CardTitle className="text-lg truncate">{address.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Obłożenie</span>
                                                <span className="font-bold">{address.occupantCount} / {address.capacity > 0 ? address.capacity : 'N/A'}</span>
                                            </div>
                                            <div className="mt-2">
                                                {address.capacity > 0 ? (
                                                    <Progress value={occupancyPercentage} className={cn("h-3 [&>div]:transition-all [&>div]:duration-500", getOccupancyColor(occupancyPercentage))} />
                                                ) : <div className="h-3 bg-muted rounded-full" />}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            }) : (
                                <p className="text-center text-muted-foreground py-10">Brak adresów pasujących do wyszukiwania.</p>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Dialog open={isHousingDetailOpen} onOpenChange={setIsHousingDetailOpen}>
                <DialogContent className="max-w-3xl flex flex-col h-screen sm:h-[90vh]">
                {selectedAddress && (
                    <>
                    <DialogHeader className="text-center">
                        <DialogTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                            {selectedAddress.name}
                        </DialogTitle>
                        <DialogDescription>Szczegóły obłożenia</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-2 text-center py-4">
                        <div>
                            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                                <Users className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                            <p className="font-bold text-2xl mt-2 text-red-600 dark:text-red-400">{selectedAddress.occupantCount}</p>
                            <p className="text-xs text-muted-foreground">Zajęte</p>
                        </div>
                        <div>
                             <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                <Bed className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="font-bold text-2xl mt-2 text-green-600 dark:text-green-400">{isFinite(selectedAddress.available) ? selectedAddress.available : '∞'}</p>
                            <p className="text-xs text-muted-foreground">Wolne</p>
                        </div>
                        <div>
                             <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-6 w-6 text-primary" />
                            </div>
                            <p className="font-bold text-2xl mt-2 text-primary">{selectedAddress.capacity > 0 ? selectedAddress.capacity : 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">Pojemność</p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-4 flex-1 flex flex-col min-h-0">
                        <h4 className="font-medium text-sm text-primary">Pokoje</h4>
                        <ScrollArea className="flex-1 -mr-6 pr-6">
                            <div className="space-y-4">
                                {Object.entries(groupedRooms).map(([groupNumber, groupData], index) => (
                                <Card key={groupNumber} className="shadow-sm animate-in fade-in-0 duration-300" style={{animationDelay: `${index * 100}ms`}}>
                                    <CardHeader className="p-3">
                                        <CardTitle className="text-base">Mieszkanie {groupNumber}</CardTitle>
                                        <CardDescription>Miejsca: {groupData.capacity}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {groupData.rooms.map((room) => (
                                        <div key={room.roomNumber} onClick={() => {setSelectedRoom(room); setIsRoomDetailOpen(true);}} className="flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer hover:bg-muted/50 hover:border-primary transition-colors">
                                            <span className="font-bold text-lg">{room.roomNumber.split('.')[1] || room.roomNumber}</span>
                                            <div className={cn("flex items-center gap-1 text-xs font-semibold mt-1", room.available > 0 ? 'text-green-600' : 'text-red-600')}>
                                                <Bed className="h-3 w-3" />
                                                <span>{room.available} wolne</span>
                                            </div>
                                        </div>
                                    ))}
                                    </CardContent>
                                </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    </>
                )}
                </DialogContent>
            </Dialog>

            <Dialog open={isRoomDetailOpen} onOpenChange={setIsRoomDetailOpen}>
                <DialogContent className="max-w-md flex flex-col h-screen sm:h-[80vh]">
                {selectedRoom && (
                    <TooltipProvider>
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle className="text-primary">Pokój {selectedRoom.roomNumber}</DialogTitle>
                                <DialogDescription>Lista mieszkańców</DialogDescription>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => handleCopy(selectedRoom.occupants)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Kopiuj listę</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1 -mr-6 pr-6">
                        <div className="space-y-2">
                        {selectedRoom.occupants.length > 0 ? selectedRoom.occupants.map((occupant, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 shadow-sm animate-in fade-in-0 duration-300" style={{animationDelay: `${index * 50}ms`}}>
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">{occupant.fullName.slice(0,2).toUpperCase()}</div>
                                <span className="font-medium text-sm">{occupant.fullName}</span>
                            </div>
                        )) : <p className='text-center text-muted-foreground p-4'>Brak mieszkańców</p>}
                        </div>
                    </ScrollArea>
                    </TooltipProvider>
                )}
                </DialogContent>
            </Dialog>
        </>
    );
}
