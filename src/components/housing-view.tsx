

"use client";

import React, { useState, useMemo } from 'react';
import type { Employee, NonEmployee, SessionData, Address, Room } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Bed, Building, User, BarChart2, SlidersHorizontal } from "lucide-react";
import { useMainLayout } from '@/components/main-layout';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip as RechartsTooltip } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';

type Occupant = Employee | NonEmployee;
type RoomWithOccupants = Room & { occupants: Occupant[]; occupantCount: number; available: number; };
type HousingData = ReturnType<typeof useHousingData>[0];

const isEmployee = (occupant: Occupant): occupant is Employee => 'coordinatorId' in occupant;

const calculateStats = (occupants: Occupant[]) => {
    const stats = {
        nationalities: new Map<string, number>(),
        genders: new Map<string, number>(),
    };
    occupants.forEach(occ => {
        if (isEmployee(occ)) {
            stats.nationalities.set(occ.nationality || 'Brak', (stats.nationalities.get(occ.nationality || 'Brak') || 0) + 1);
            stats.genders.set(occ.gender || 'Brak', (stats.genders.get(occ.gender || 'Brak') || 0) + 1);
        }
    });
    return {
        nationalities: Array.from(stats.nationalities.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        genders: Array.from(stats.genders.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    };
};

const NoDataState = ({ message, className }: { message: string, className?: string }) => (
    <div className={cn("flex h-full w-full min-h-[150px] items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20", className)}>
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs">{message}</p>
        </div>
    </div>
);

const StatsCharts = ({ occupants, chartConfig }: { occupants: Occupant[], chartConfig: ChartConfig }) => {
    const statsData = useMemo(() => calculateStats(occupants), [occupants]);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Wg narodowości</CardTitle>
                </CardHeader>
                <CardContent>
                    {statsData.nationalities.length > 0 ? (
                        <ResponsiveContainer width="100%" height={statsData.nationalities.length * 25 + 20}>
                            <BarChart data={statsData.nationalities} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={80} className="text-xs" interval={0} />
                                <XAxis type="number" hide />
                                <RechartsTooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                                <Bar dataKey="count" fill={chartConfig.nationalities.color} radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <NoDataState message="Brak danych" />}
                </CardContent>
            </Card>
            <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Wg płci</CardTitle>
                </CardHeader>
                <CardContent>
                     {statsData.genders.length > 0 ? (
                        <ResponsiveContainer width="100%" height={statsData.genders.length * 30 + 20}>
                            <BarChart data={statsData.genders} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={80} className="text-xs" interval={0} />
                                <XAxis type="number" hide />
                                <RechartsTooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                                <Bar dataKey="count" fill={chartConfig.genders.color} radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <NoDataState message="Brak danych" />}
                </CardContent>
            </Card>
        </div>
    );
};


const AddressDetailView = ({
  addresses,
  onOccupantClick,
  selectedAddressIds,
  onRoomClick,
  selectedRoomId
}: {
  addresses: HousingData[];
  onOccupantClick: (occupant: Occupant) => void;
  selectedAddressIds: string[];
  onRoomClick: (roomId: string) => void;
  selectedRoomId: string | null;
}) => {
    
    const selectedAddressesData = useMemo(() => {
        return addresses.filter(a => selectedAddressIds.includes(a.id));
    }, [addresses, selectedAddressIds]);
    
    const aggregatedData = useMemo(() => {
        if (selectedAddressesData.length === 0) return null;

        if (selectedAddressesData.length === 1) {
            const singleAddress = selectedAddressesData[0];
            return {
                isMultiple: false,
                name: singleAddress.name,
                occupants: singleAddress.occupants,
                occupantCount: singleAddress.occupantCount,
                capacity: singleAddress.capacity,
                available: singleAddress.available,
                rooms: singleAddress.rooms,
            }
        }
        
        const totalOccupantCount = selectedAddressesData.reduce((sum, a) => sum + a.occupantCount, 0);
        const totalCapacity = selectedAddressesData.reduce((sum, a) => sum + a.capacity, 0);
        const allOccupants = selectedAddressesData.flatMap(a => a.occupants);

        return {
            isMultiple: true,
            name: `${selectedAddressesData.length} wybrane adresy`,
            occupants: allOccupants,
            occupantCount: totalOccupantCount,
            capacity: totalCapacity,
            available: totalCapacity - totalOccupantCount,
            rooms: [], // Don't show individual rooms for multi-select
        }
    }, [selectedAddressesData]);


    const selectedRoom = useMemo(() => {
        if (!aggregatedData || aggregatedData.isMultiple || !selectedRoomId) return null;
        return aggregatedData.rooms.find(r => r.id === selectedRoomId) ?? null;
    }, [aggregatedData, selectedRoomId]);

    const chartConfig: ChartConfig = {
        count: { label: "Ilość" },
        nationalities: { label: "Nationalities", color: "hsl(var(--chart-2))" },
        genders: { label: "Genders", color: "hsl(var(--chart-1))" },
    };
    
    if (!aggregatedData) {
        return (
            <Card className="lg:col-span-2 h-full">
                <CardHeader>
                    <CardTitle>Szczegóły adresu</CardTitle>
                    <CardDescription>Wybierz adres z listy, aby zobaczyć szczegóły.</CardDescription>
                </CardHeader>
                <CardContent>
                    <NoDataState message="Nie wybrano adresu" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="lg:col-span-2 h-full">
            <CardHeader>
                <CardTitle>{aggregatedData.name}</CardTitle>
                <CardDescription>
                    <span>{aggregatedData.occupantCount} / {aggregatedData.capacity} mieszkańców</span>
                    <span className={cn("ml-2 font-bold", aggregatedData.available > 0 ? "text-green-600" : "text-red-600")}>
                        ({aggregatedData.available} wolnych miejsc)
                    </span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh - 16rem)]">
                    {aggregatedData.isMultiple ? (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-4">Statystyki łączne</h3>
                                <StatsCharts occupants={aggregatedData.occupants} chartConfig={chartConfig} />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-4">Statystyki indywidualne</h3>
                                <Accordion type="multiple" className="w-full space-y-3">
                                    {selectedAddressesData.map(address => (
                                        <Card asChild key={address.id} className="overflow-hidden">
                                            <AccordionItem value={address.id} className="border-b-0">
                                                <AccordionTrigger className="p-4 hover:no-underline">
                                                    <div className="w-full">
                                                        <div className="flex justify-between items-start">
                                                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                                                {address.name}
                                                            </CardTitle>
                                                            <span className="text-base">
                                                                <span>{address.occupantCount} / {address.capacity}</span>
                                                            </span>
                                                        </div>
                                                        <CardDescription className="text-xs pt-1 text-left">
                                                            Wolne miejsca: <span className={cn("font-bold", address.available > 0 ? "text-green-600" : "text-red-600")}>{address.available}</span>
                                                        </CardDescription>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 pt-0">
                                                    <StatsCharts occupants={address.occupants} chartConfig={chartConfig} />
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Card>
                                    ))}
                                </Accordion>
                            </div>
                        </div>
                    ) : (
                       <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                            <div className="space-y-4">
                                <h3 className="font-semibold">Pokoje</h3>
                                {aggregatedData.rooms.length > 0 ? aggregatedData.rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(room => (
                                    <div
                                        key={room.id}
                                        className={cn(
                                            "rounded-md border p-3 cursor-pointer transition-colors",
                                            selectedRoomId === room.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50",
                                            room.available > 0 && selectedRoomId !== room.id && "bg-green-500/10 border-green-500/20"
                                        )}
                                        onClick={() => onRoomClick(room.id)}
                                    >
                                        <div className="flex justify-between items-center font-medium">
                                            <div className="flex items-center gap-2">
                                                <Bed className="h-4 w-4 text-muted-foreground" />
                                                Pokój {room.name}
                                            </div>
                                            <span className="text-sm">
                                                <span>{room.occupantCount} / {room.capacity}</span>
                                            </span>
                                        </div>
                                        <div className="pl-4 mt-2 space-y-1">
                                            {room.occupants.map(o => (
                                                <div key={o.id} onClick={(e) => { e.stopPropagation(); onOccupantClick(o); }} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary">
                                                    <User className="h-3 w-3" />
                                                    {o.fullName}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )) : <NoDataState message="Brak pokoi dla tego adresu" />}
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold">{selectedRoom ? `Statystyki dla pokoju ${selectedRoom.name}` : "Statystyki dla adresu"}</h3>
                                <StatsCharts occupants={selectedRoom ? selectedRoom.occupants : aggregatedData.occupants} chartConfig={chartConfig} />
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
};


const useHousingData = () => {
    const { allEmployees, allNonEmployees, settings, currentUser, selectedCoordinatorId } = useMainLayout();

    return useMemo(() => {
        if (!settings || !allEmployees || !allNonEmployees || !currentUser) return [];

        let addressesToDisplay = settings.addresses;
        if (!currentUser.isAdmin || (currentUser.isAdmin && selectedCoordinatorId !== 'all')) {
             addressesToDisplay = settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));
        }
        
        const allActiveOccupants: Occupant[] = [
            ...allEmployees.filter(e => e.status === 'active'),
            ...allNonEmployees
        ];

        return addressesToDisplay.map(address => {
            const occupantsInAddress = allActiveOccupants.filter(o => o.address === address.name);
            const totalCapacity = address.rooms.reduce((sum, room) => sum + room.capacity, 0);
            const occupantCount = occupantsInAddress.length;

            const rooms: RoomWithOccupants[] = address.rooms.map(room => {
                const occupantsInRoom = occupantsInAddress.filter(o => o.roomNumber === room.name);
                return {
                    id: room.id,
                    name: room.name,
                    capacity: room.capacity,
                    occupants: occupantsInRoom,
                    occupantCount: occupantsInRoom.length,
                    available: room.capacity - occupantsInRoom.length,
                };
            });

            return {
                id: address.id,
                name: address.name,
                occupants: occupantsInAddress,
                occupantCount: occupantCount,
                capacity: totalCapacity,
                available: totalCapacity - occupantCount,
                occupancy: totalCapacity > 0 ? (occupantCount / totalCapacity) * 100 : 0,
                rooms: rooms
            };
        });

    }, [allEmployees, allNonEmployees, settings, currentUser, selectedCoordinatorId]);
}


const MobileAddressCard = ({ address, onOccupantClick }: { address: HousingData; onOccupantClick: (occupant: Occupant) => void }) => {

    return (
        <Card asChild className={cn("overflow-hidden", address.available > 0 && "border-green-500/30")}>
            <AccordionItem value={address.id} className="border-b-0">
                <AccordionTrigger className="p-4 hover:no-underline">
                    <div className="w-full">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Building className="h-5 w-5 text-primary" />
                                {address.name}
                            </CardTitle>
                            <span className="text-base">
                                <span className="font-semibold">{address.occupantCount}</span>
                                <span className="text-muted-foreground"> / </span>
                                <span className="font-semibold">{address.capacity}</span>
                            </span>
                        </div>
                        <CardDescription className="text-xs pt-1 text-left">
                            Wolne miejsca: <span className={cn("font-bold", address.available > 0 ? "text-green-600" : "text-red-600")}>{address.available}</span>
                        </CardDescription>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0">
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Pokoje</h4>
                            <div className="space-y-2">
                                {address.rooms.sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(room => (
                                    <div key={room.id} className={cn("rounded-md border p-3", room.available > 0 && "bg-green-500/10 border-green-500/20")}>
                                        <div className="flex justify-between items-center font-medium text-sm">
                                            <div className="flex items-center gap-2">
                                                <Bed className="h-4 w-4 text-muted-foreground" />
                                                Pokój {room.name}
                                            </div>
                                            <span className="text-sm">
                                                <span className="font-semibold">{room.occupantCount}</span>
                                                <span className="text-muted-foreground"> / </span>
                                                <span className="font-semibold">{room.capacity}</span>
                                            </span>
                                        </div>
                                         <div className="pl-4 mt-2 space-y-1">
                                            {room.occupants.map(o => (
                                                <div key={o.id} onClick={() => onOccupantClick(o)} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary">
                                                    <User className="h-3 w-3" />
                                                    {o.fullName}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <div>
                            <h4 className="text-sm font-semibold mb-2">Statystyki</h4>
                            <StatsCharts occupants={address.occupants} chartConfig={{
                                count: { label: "Ilość" },
                                nationalities: { label: "Nationalities", color: "hsl(var(--chart-2))" },
                                genders: { label: "Genders", color: "hsl(var(--chart-1))" },
                            }} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Card>
    )
}

const FilterDialog = ({ isOpen, onOpenChange, onApply, initialFilters, settings }: { isOpen: boolean, onOpenChange: (open: boolean) => void; onApply: (filters: Record<string, string | boolean>) => void; initialFilters: Record<string, string | boolean>, settings: Settings | null }) => {
    const [filters, setFilters] = useState(initialFilters);

    const handleFilterChange = (key: string, value: string | boolean) => {
        setFilters(prev => ({...prev, [key]: value}));
    }
    
    const handleApply = () => {
        onApply(filters);
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Filtruj adresy</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="search-address">Szukaj adresu</Label>
                        <Input 
                            id="search-address"
                            placeholder="Wpisz nazwę adresu..."
                            value={filters.name as string}
                            onChange={e => handleFilterChange('name', e.target.value)}
                        />
                    </div>
                     <div className="flex items-center space-x-2 pt-2">
                        <Switch 
                            id="show-available" 
                            checked={filters.showOnlyAvailable as boolean}
                            onCheckedChange={checked => handleFilterChange('showOnlyAvailable', checked)}
                        />
                        <Label htmlFor="show-available">Tylko z wolnymi miejscami</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
                    <Button onClick={handleApply}>Zastosuj</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export default function HousingView({ }: { currentUser: SessionData }) {
    const { settings, handleEditEmployeeClick, handleEditNonEmployeeClick } = useMainLayout();
    const { isMobile } = useIsMobile();
    const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    const [filters, setFilters] = useState({
        name: '',
        showOnlyAvailable: false,
    });
     const [isFilterOpen, setIsFilterOpen] = useState(false);

    const rawHousingData = useHousingData();
    
    const handleOccupantClick = (occupant: Occupant) => {
        if (isEmployee(occupant)) {
            handleEditEmployeeClick(occupant);
        } else {
            handleEditNonEmployeeClick(occupant);
        }
    };
    
    const handleFilterChange = (newFilters: Record<string, string | boolean>) => {
        setFilters(prev => ({...prev, ...newFilters}));
    }

    const filteredData = useMemo(() => {
        let items = [...rawHousingData];
        
        if (filters.name) {
            items = items.filter(item => item.name.toLowerCase().includes(filters.name.toLowerCase()));
        }
        if (filters.showOnlyAvailable) {
            items = items.filter(item => item.available > 0);
        }
        
        items.sort((a,b) => a.name.localeCompare(b.name));

        return items;
    }, [rawHousingData, filters]);
    
    const handleAddressClick = (addressId: string) => {
        setSelectedRoomId(null);
        setSelectedAddressIds(prev => {
            const isSelected = prev.includes(addressId);
            if(isSelected) {
                return prev.filter(id => id !== addressId);
            } else {
                return [...prev, addressId];
            }
        });
    };

    const handleRoomClick = (roomId: string) => {
        setSelectedRoomId(prev => (prev === roomId ? null : roomId));
    };
    
    if (!rawHousingData || !settings) {
        return <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
    }
    
    // Mobile View
    if (isMobile) {
        return (
            <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Adresy</CardTitle>
                            <CardDescription>Przegląd zakwaterowania</CardDescription>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => setIsFilterOpen(true)}>
                            <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[calc(100vh-14rem)] -mx-4 px-4">
                        <Accordion type="multiple" className="w-full space-y-3">
                            {filteredData.map(address => (
                                <MobileAddressCard 
                                    key={address.id}
                                    address={address}
                                    onOccupantClick={handleOccupantClick}
                                />
                            ))}
                        </Accordion>
                    </ScrollArea>
                </CardContent>
            </Card>
            <FilterDialog
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                initialFilters={filters}
                onApply={handleFilterChange}
                settings={settings}
            />
            </>
        )
    }

    // Desktop View
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full">
            <Card className="h-full">
                 <CardHeader className="p-4">
                    <CardTitle>Adresy</CardTitle>
                    <CardDescription>Wybierz adres, aby zobaczyć szczegóły.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="space-y-4 mb-4">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="search-address">Szukaj adresu</Label>
                            <Input 
                                id="search-address"
                                placeholder="Wpisz nazwę adresu..."
                                value={filters.name}
                                onChange={e => handleFilterChange({ name: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch 
                                id="show-available" 
                                checked={filters.showOnlyAvailable}
                                onCheckedChange={checked => handleFilterChange({ showOnlyAvailable: checked })}
                            />
                            <Label htmlFor="show-available">Tylko z wolnymi miejscami</Label>
                        </div>
                    </div>
                    <ScrollArea className="h-[calc(100vh-22rem)] lg:h-[calc(100vh - 22rem)]">
                        <div className="space-y-2">
                        {filteredData.map(address => (
                            <Card 
                                key={address.id}
                                className={cn(
                                    "cursor-pointer transition-colors",
                                    selectedAddressIds.includes(address.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50",
                                    address.available > 0 && !selectedAddressIds.includes(address.id) && "bg-green-500/10 border-green-500/20"
                                )}
                                onClick={() => handleAddressClick(address.id)}
                            >
                                <CardHeader className="p-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Building className="h-4 w-4 text-primary" />
                                            {address.name}
                                        </CardTitle>
                                        <span className="text-sm">
                                            <span className="font-semibold">{address.occupantCount}</span>
                                            <span className="text-muted-foreground"> / </span>
                                            <span className="font-semibold">{address.capacity}</span>
                                        </span>
                                    </div>
                                    <CardDescription className="text-xs pt-1">
                                        Wolne miejsca: <span className={cn("font-bold", address.available > 0 ? "text-green-600" : "text-red-600")}>{address.available}</span>
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
            <AddressDetailView 
                addresses={filteredData}
                onOccupantClick={handleOccupantClick}
                selectedAddressIds={selectedAddressIds}
                onRoomClick={handleRoomClick}
                selectedRoomId={selectedRoomId}
            />
        </div>
    );
}

