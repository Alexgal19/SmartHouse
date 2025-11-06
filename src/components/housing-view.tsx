

"use client";

import React, { useState, useMemo } from 'react';
import type { Employee, NonEmployee, SessionData, Address, Room } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Bed, Building, User, BarChart2, SlidersHorizontal, Copy } from "lucide-react";
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
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

type Occupant = Employee | NonEmployee;
type RoomWithOccupants = Room & { occupants: Occupant[]; occupantCount: number; available: number; };
type HousingData = ReturnType<typeof useHousingData>[0];

const isEmployee = (occupant: Occupant): occupant is Employee => 'coordinatorId' in occupant;

const calculateStats = (occupants: Occupant[]) => {
    const stats = {
        nationalities: new Map<string, number>(),
        genders: new Map<string, number>(),
        departments: new Map<string, number>(),
    };
    occupants.forEach(occ => {
        if (isEmployee(occ)) {
            stats.nationalities.set(occ.nationality || 'Brak', (stats.nationalities.get(occ.nationality || 'Brak') || 0) + 1);
            stats.genders.set(occ.gender || 'Brak', (stats.genders.get(occ.gender || 'Brak') || 0) + 1);
            stats.departments.set(occ.zaklad || 'Brak', (stats.departments.get(occ.zaklad || 'Brak') || 0) + 1);
        }
    });
    return {
        nationalities: Array.from(stats.nationalities.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        genders: Array.from(stats.genders.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        departments: Array.from(stats.departments.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
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
        <div className="space-y-4">
             <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Wg zakładu</CardTitle>
                </CardHeader>
                <CardContent>
                    {statsData.departments.length > 0 ? (
                        <ResponsiveContainer width="100%" height={statsData.departments.length * 25 + 20}>
                            <BarChart data={statsData.departments} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={80} className="text-xs" interval={0} />
                                <XAxis type="number" hide />
                                <RechartsTooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                                <Bar dataKey="count" fill={chartConfig.departments.color} radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <NoDataState message="Brak danych" />}
                </CardContent>
            </Card>
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
  selectedRoomIds
}: {
  addresses: HousingData[];
  onOccupantClick: (occupant: Occupant) => void;
  selectedAddressIds: string[];
  onRoomClick: (roomId: string) => void;
  selectedRoomIds: string[];
}) => {
    const { copyToClipboard } = useCopyToClipboard();
    
    const selectedAddressesData = useMemo(() => {
        return addresses.filter(a => selectedAddressIds.includes(a.id));
    }, [addresses, selectedAddressIds]);
    
    const aggregatedAddressesData = useMemo(() => {
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


    const selectedRoomsData = useMemo(() => {
        if (!aggregatedAddressesData || aggregatedAddressesData.isMultiple || selectedRoomIds.length === 0) return null;
        
        const rooms = aggregatedAddressesData.rooms.filter(r => selectedRoomIds.includes(r.id));
        if (rooms.length === 0) return null;

        const totalOccupantCount = rooms.reduce((sum, r) => sum + r.occupantCount, 0);
        const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
        const allOccupants = rooms.flatMap(r => r.occupants);

        return {
            isMultiple: rooms.length > 1,
            name: rooms.length > 1 ? `${rooms.length} wybrane pokoje` : `Pokój ${rooms[0].name}`,
            occupants: allOccupants,
            occupantCount: totalOccupantCount,
            capacity: totalCapacity,
            available: totalCapacity - totalOccupantCount,
            rooms: rooms,
        }
    }, [aggregatedAddressesData, selectedRoomIds]);

    const chartConfig: ChartConfig = {
        count: { label: "Ilość" },
        nationalities: { label: "Nationalities", color: "hsl(var(--chart-2))" },
        genders: { label: "Genders", color: "hsl(var(--chart-1))" },
        departments: { label: "Zakłady", color: "hsl(var(--chart-3))" }
    };
    
    if (!aggregatedAddressesData) {
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
                <CardTitle>{selectedRoomsData ? selectedRoomsData.name : aggregatedAddressesData.name}</CardTitle>
                <CardDescription>
                    <span>
                      {(selectedRoomsData || aggregatedAddressesData).occupantCount} / {(selectedRoomsData || aggregatedAddressesData).capacity} mieszkańców
                    </span>
                    <span className={cn("ml-2 font-bold", (selectedRoomsData || aggregatedAddressesData).available > 0 ? "text-green-600" : "text-red-600")}>
                        ({(selectedRoomsData || aggregatedAddressesData).available} wolnych miejsc)
                    </span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh - 16rem)]">
                    {aggregatedAddressesData.isMultiple ? (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-4">Statystyki łączne</h3>
                                <StatsCharts occupants={aggregatedAddressesData.occupants} chartConfig={chartConfig} />
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
                                {aggregatedAddressesData.rooms.length > 0 ? aggregatedAddressesData.rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(room => (
                                    <div
                                        key={room.id}
                                        className={cn(
                                            "rounded-md border p-3 cursor-pointer transition-colors",
                                            selectedRoomIds.includes(room.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50",
                                            room.available > 0 && !selectedRoomIds.includes(room.id) && "bg-green-500/10 border-green-500/20"
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
                                                <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground group">
                                                    <span onClick={(e) => { e.stopPropagation(); onOccupantClick(o); }} className="cursor-pointer hover:text-primary flex-1">{o.fullName}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); copyToClipboard(o.fullName, `Skopiowano: ${o.fullName}`)}}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )) : <NoDataState message="Brak pokoi dla tego adresu" />}
                            </div>
                            <div className="space-y-4">
                                {selectedRoomsData ? (
                                    selectedRoomsData.isMultiple ? (
                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="font-semibold mb-4">Statystyki łączne dla pokoi</h3>
                                                <StatsCharts occupants={selectedRoomsData.occupants} chartConfig={chartConfig} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold mb-4">Statystyki indywidualne dla pokoi</h3>
                                                <Accordion type="multiple" className="w-full space-y-3">
                                                    {selectedRoomsData.rooms.map(room => (
                                                        <Card asChild key={room.id} className="overflow-hidden">
                                                            <AccordionItem value={room.id} className="border-b-0">
                                                                <AccordionTrigger className="p-4 hover:no-underline">
                                                                    <div className="w-full">
                                                                        <div className="flex justify-between items-start">
                                                                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                                                                Pokój {room.name}
                                                                            </CardTitle>
                                                                            <span className="text-base">
                                                                                <span>{room.occupantCount} / {room.capacity}</span>
                                                                            </span>
                                                                        </div>
                                                                        <CardDescription className="text-xs pt-1 text-left">
                                                                            Wolne miejsca: <span className={cn("font-bold", room.available > 0 ? "text-green-600" : "text-red-600")}>{room.available}</span>
                                                                        </CardDescription>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent className="p-4 pt-0">
                                                                    <StatsCharts occupants={room.occupants} chartConfig={chartConfig} />
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        </Card>
                                                    ))}
                                                </Accordion>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                          <h3 className="font-semibold">Statystyki dla pokoju {selectedRoomsData.rooms[0].name}</h3>
                                          <StatsCharts occupants={selectedRoomsData.occupants} chartConfig={chartConfig} />
                                        </>
                                    )
                                ) : (
                                    <>
                                        <h3 className="font-semibold">Statystyki dla adresu</h3>
                                        <StatsCharts occupants={aggregatedAddressesData.occupants} chartConfig={chartConfig} />
                                    </>
                                )}
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
                locality: address.locality,
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
    const { copyToClipboard } = useCopyToClipboard();

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
                                <span>{address.occupantCount} / {address.capacity}</span>
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
                                                <span>{room.occupantCount} / {room.capacity}</span>
                                            </span>
                                        </div>
                                         <div className="pl-4 mt-2 space-y-1">
                                            {room.occupants.map(o => (
                                                <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground group">
                                                    <span onClick={() => onOccupantClick(o)} className="cursor-pointer hover:text-primary">{o.fullName}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); copyToClipboard(o.fullName, `Skopiowano: ${o.fullName}`)}}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
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
                                departments: { label: "Zakłady", color: "hsl(var(--chart-3))" }
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
    const sortedLocalities = useMemo(() => [...(settings?.localities || [])].sort((a,b) => a.localeCompare(b)), [settings?.localities]);

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
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="search-locality">Miejscowość</Label>
                        <Select value={filters.locality as string} onValueChange={(v) => handleFilterChange('locality', v)}>
                            <SelectTrigger id="search-locality"><SelectValue placeholder="Wszystkie miejscowości" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszystkie miejscowości</SelectItem>
                                {sortedLocalities.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="flex items-center space-x-2 pt-2">
                        <Switch 
                            id="show-available" 
                            checked={filters.showOnlyAvailable as boolean}
                            onCheckedChange={checked => handleFilterChange('showOnlyAvailable', checked)}
                        />
                        <Label htmlFor="show-available">Tylko z wolnymi miejscami</Label>GLHF
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
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

    const [filters, setFilters] = useState({
        name: '',
        locality: 'all',
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
        if (filters.locality !== 'all') {
            items = items.filter(item => item.locality === filters.locality);
        }
        if (filters.showOnlyAvailable) {
            items = items.filter(item => item.available > 0);
        }
        
        items.sort((a,b) => a.name.localeCompare(b.name));

        return items;
    }, [rawHousingData, filters]);

    const groupedByLocality = useMemo(() => {
        const grouped = filteredData.reduce((acc, address) => {
            const locality = address.locality || 'Inne';
            if (!acc[locality]) {
                acc[locality] = [];
            }
            acc[locality].push(address);
            return acc;
        }, {} as Record<string, HousingData[]>);
        return Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0]));
    }, [filteredData]);
    
    const handleAddressClick = (addressId: string) => {
        setSelectedRoomIds([]);
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
        setSelectedRoomIds(prev => {
            const isSelected = prev.includes(roomId);
            if (isSelected) {
                return prev.filter(id => id !== roomId);
            } else {
                return [...prev, roomId];
            }
        });
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
                            {groupedByLocality.map(([locality, addresses]) => (
                                <AccordionItem value={locality} key={locality} className="border-b-0">
                                    <AccordionTrigger className="text-lg font-bold sticky top-0 bg-background py-3">{locality}</AccordionTrigger>
                                    <AccordionContent className="space-y-3">
                                        {addresses.map(address => (
                                            <MobileAddressCard 
                                                key={address.id}
                                                address={address}
                                                onOccupantClick={handleOccupantClick}
                                            />
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
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
                         <Button onClick={() => setIsFilterOpen(true)} variant="outline" className="w-full">
                            <SlidersHorizontal className="h-4 w-4 mr-2"/>
                            Filtry ({Object.values(filters).filter(v => v && v !== 'all').length})
                        </Button>
                    </div>
                    <ScrollArea className="h-[calc(100vh-22rem)] lg:h-[calc(100vh - 18rem)]">
                        <Accordion type="multiple" defaultValue={groupedByLocality.map(g => g[0])} className="w-full">
                             {groupedByLocality.map(([locality, addresses]) => (
                                <AccordionItem value={locality} key={locality}>
                                    <AccordionTrigger className="text-md font-semibold">{locality}</AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        {addresses.map(address => (
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
                                                            <span>{address.occupantCount} / {address.capacity}</span>
                                                        </span>
                                                    </div>
                                                    <CardDescription className="text-xs pt-1">
                                                        Wolne miejsca: <span className={cn("font-bold", address.available > 0 ? "text-green-600" : "text-red-600")}>{address.available}</span>
                                                    </CardDescription>
                                                </CardHeader>
                                            </Card>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                             ))}
                        </Accordion>
                    </ScrollArea>
                </CardContent>
            </Card>
            <AddressDetailView 
                addresses={filteredData}
                onOccupantClick={handleOccupantClick}
                selectedAddressIds={selectedAddressIds}
                onRoomClick={handleRoomClick}
                selectedRoomIds={selectedRoomIds}
            />
             <FilterDialog
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                initialFilters={filters}
                onApply={handleFilterChange}
                settings={settings}
            />
        </div>
    );
}
