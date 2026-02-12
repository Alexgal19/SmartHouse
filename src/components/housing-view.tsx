

"use client";

import React, { useState, useMemo } from 'react';
import type { Employee, NonEmployee, SessionData, Room, Settings } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bed, Building, BarChart2, Copy, Lock } from "lucide-react";
import { useMainLayout } from '@/components/main-layout';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip as RechartsTooltip } from "recharts";
import { ChartConfig, ChartTooltipContent } from "@/components/ui/chart";
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Badge } from './ui/badge';
import { getActiveAddressCapacity } from '@/lib/address-filters';

type Occupant = Employee | NonEmployee;
type RoomWithOccupants = Room & { occupants: Occupant[]; occupantCount: number; available: number; };
type HousingData = ReturnType<typeof useHousingData>[0];

const isEmployee = (occupant: Occupant): occupant is Employee => 'zaklad' in occupant;

const calculateStats = (occupants: Occupant[]) => {
    const stats = {
        nationalities: new Map<string, number>(),
        genders: new Map<string, number>(),
        departments: new Map<string, number>(),
    };
    occupants.forEach(occ => {
        stats.nationalities.set(occ.nationality || 'Brak', (stats.nationalities.get(occ.nationality || 'Brak') || 0) + 1);
        stats.genders.set(occ.gender || 'Brak', (stats.genders.get(occ.gender || 'Brak') || 0) + 1);

        if (isEmployee(occ)) {
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
                    <CardTitle className="text-sm">Wg narodowości</CardTitle>
                </CardHeader>
                <CardContent>
                    {statsData.nationalities.length > 0 ? (
                        <ResponsiveContainer width="100%" height={statsData.nationalities.length * 25 + 20}>
                            <BarChart data={statsData.nationalities} layout="vertical" margin={{ left: 10, right: 40 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={80} className="text-xs" interval={0} />
                                <XAxis type="number" hide={true} />
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
                            <BarChart data={statsData.genders} layout="vertical" margin={{ left: 10, right: 40 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={80} className="text-xs" interval={0} />
                                <XAxis type="number" hide={true} />
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
    const isSingleSelectedBlocked = useMemo(() => {
        const selected = addresses.filter(a => selectedAddressIds.includes(a.id));
        return selected.length === 1 && selected[0].isActive === false;
    }, [addresses, selectedAddressIds]);
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
            rooms: [],
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
        <Card className={cn("lg:col-span-2 h-full", isSingleSelectedBlocked && "border-destructive/50 bg-destructive/5")}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {selectedRoomsData ? selectedRoomsData.name : aggregatedAddressesData.name}
                    {isSingleSelectedBlocked && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Zablokowany
                        </Badge>
                    )}
                </CardTitle>
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
                                        <Card key={address.id} className="overflow-hidden">
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
                                {aggregatedAddressesData.rooms.length > 0 ? aggregatedAddressesData.rooms.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })).map(room => (
                                    <div
                                        key={room.id}
                                        className={cn(
                                            "rounded-md border p-3 cursor-pointer transition-colors",
                                            selectedRoomIds.includes(room.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50",
                                            !room.isActive && "bg-destructive/10 border-destructive/20",
                                            room.isLocked && "bg-yellow-500/10 border-yellow-500/30",
                                            room.isActive && !room.isLocked && room.available > 0 && !selectedRoomIds.includes(room.id) && "bg-green-500/10 border-green-500/20"
                                        )}
                                        onClick={() => onRoomClick(room.id)}
                                    >
                                        <div className="flex justify-between items-center font-medium">
                                            <div className="flex items-center gap-2">
                                                <Bed className="h-4 w-4 text-muted-foreground" />
                                                Pokój {room.name}
                                                {room.isLocked && <Lock className="h-3 w-3 ml-1 text-yellow-600" />}
                                            </div>
                                            <span className="text-sm">
                                                <span>{room.occupantCount} / {room.capacity}</span>
                                            </span>
                                        </div>
                                        <div className="pl-4 mt-2 space-y-1">
                                            {room.occupants.map(o => {
                                                const fullName = `${o.firstName} ${o.lastName}`.trim();
                                                const isBlocked = isSingleSelectedBlocked || room.isLocked || !room.isActive;
                                                return (
                                                    <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground group">
                                                        <span
                                                            onClick={(e) => { e.stopPropagation(); if (!isBlocked) onOccupantClick(o); }}
                                                            className={cn("flex-1", isBlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:text-primary")}
                                                        >{fullName}</span>
                                                        {!isBlocked && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); copyToClipboard(fullName, `Skopiowano: ${fullName}`)}}>
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )
                                            })}
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
                                                        <Card key={room.id} className="overflow-hidden">
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
             const coordId = currentUser.isAdmin ? selectedCoordinatorId : currentUser.uid;
             addressesToDisplay = settings.addresses.filter(a => a.coordinatorIds.includes(coordId));
        }
        
        const allActiveOccupants: Occupant[] = [
            ...allEmployees.filter(e => e.status === 'active'),
            ...allNonEmployees.filter(ne => ne.status === 'active')
        ];

        return addressesToDisplay.map(address => {
            const occupantsInAddress = allActiveOccupants.filter(o => o.address === address.name);
            // Only count capacity from active (non-blocked) rooms
            const totalCapacity = getActiveAddressCapacity(address);
            const occupantCount = occupantsInAddress.length;

            const rooms: RoomWithOccupants[] = address.rooms.map(room => {
                const occupantsInRoom = occupantsInAddress.filter(o => o.roomNumber === room.name);
                return {
                    id: room.id,
                    name: room.name,
                    capacity: room.capacity,
                    isActive: room.isActive,
                    isLocked: room.isLocked,
                    occupants: occupantsInRoom,
                    occupantCount: occupantsInRoom.length,
                    available: room.capacity - occupantsInRoom.length,
                };
            });

            return {
                id: address.id,
                name: address.name,
                locality: address.locality,
                isActive: address.isActive,
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


const MobileAddressCard = ({ address, onOccupantClick, currentUser, settings, handleUpdateSettings, style }: { address: HousingData; onOccupantClick: (occupant: Occupant) => void; currentUser: SessionData; settings: Settings; handleUpdateSettings: (updates: Partial<Settings>) => Promise<void>; style?: React.CSSProperties }) => {
    const { copyToClipboard } = useCopyToClipboard();

    return (
        <Card className={cn(
            "overflow-hidden animate-fade-in-up",
            !address.isActive && "border-destructive/50 bg-destructive/5",
            address.isActive && address.available > 0 && "border-green-500/30"
        )} style={style}>
            <AccordionItem value={address.id} className="border-b-0">
                <AccordionTrigger className="p-4 hover:no-underline">
                    <div className="w-full">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Building className={cn("h-5 w-5", address.isActive ? "text-primary" : "text-destructive")} />
                                {address.name}
                                {!address.isActive && (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                        <Lock className="h-3 w-3 mr-0.5" />
                                        Zablokowany
                                    </Badge>
                                )}
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
                                {address.rooms.sort((a,b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })).map(room => (
                                    <div key={room.id} className={cn("rounded-md border p-3", !room.isActive && "bg-destructive/10 border-destructive/20", room.isLocked && "bg-yellow-500/10 border-yellow-500/30", room.isActive && !room.isLocked && room.available > 0 && "bg-green-500/10 border-green-500/20")}>
                                        <div className="flex justify-between items-center font-medium text-sm">
                                            <div className="flex items-center gap-2">
                                                <Bed className="h-4 w-4 text-muted-foreground" />
                                                Pokój {room.name}
                                                {room.isLocked && <Lock className="h-3 w-3 text-yellow-600" />}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm">
                                                    <span>{room.occupantCount} / {room.capacity}</span>
                                                </span>
                                                {currentUser.isAdmin && (
                                                    <div className="flex items-center gap-2">
                                                        <Label htmlFor={`lock-${room.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                                            {room.isLocked ? 'Odblokuj' : 'Zablokuj'}
                                                        </Label>
                                                        <Switch
                                                            id={`lock-${room.id}`}
                                                            checked={room.isLocked || false}
                                                            onCheckedChange={async (checked) => {
                                                                const updatedAddresses = settings!.addresses.map(a =>
                                                                    a.id === address.id
                                                                        ? { ...a, rooms: a.rooms.map(r => r.id === room.id ? { ...r, isLocked: checked } : r) }
                                                                        : a
                                                                );
                                                                await handleUpdateSettings({ addresses: updatedAddresses });
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                         <div className="pl-4 mt-2 space-y-1">
                                            {room.occupants.map(o => {
                                                const fullName = `${o.firstName} ${o.lastName}`.trim();
                                                const isBlocked = !address.isActive || room.isLocked || !room.isActive;
                                                return (
                                                    <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground group">
                                                        <span
                                                            onClick={() => { if (!isBlocked) onOccupantClick(o); }}
                                                            className={cn(isBlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:text-primary")}
                                                        >{fullName}</span>
                                                        {!isBlocked && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); copyToClipboard(fullName, `Skopiowano: ${fullName}`)}}>
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )
                                            })}
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

export const FilterControls = ({ filters, onFilterChange, settings, currentUser }: { filters: { name: string; locality: string; showOnlyAvailable: boolean }, onFilterChange: (filters: { name: string; locality: string; showOnlyAvailable: boolean }) => void, settings: Settings | null, currentUser: SessionData | null }) => {
    
    const sortedLocalities = useMemo(() => {
        if (!settings || !currentUser) return [];

        if (currentUser.isAdmin) {
            return [...settings.localities].sort((a, b) => a.localeCompare(b));
        }
        
        const coordinatorAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(currentUser.uid));
        const uniqueLocalities = [...new Set(coordinatorAddresses.map(a => a.locality))];
        return uniqueLocalities.sort((a, b) => a.localeCompare(b));

    }, [settings, currentUser]);

    const handleValueChange = (key: string, value: string | boolean) => {
        onFilterChange({ ...filters, [key]: value });
    }

    return (
        <div className="flex flex-wrap items-end gap-4">
            <div className="grid flex-1 min-w-[150px] items-center gap-1.5">
                <Label htmlFor="search-address">Szukaj adresu</Label>
                <Input 
                    id="search-address"
                    placeholder="Wpisz nazwę adresu..."
                    value={filters.name as string}
                    onChange={e => handleValueChange('name', e.target.value)}
                />
            </div>
            <div className="grid flex-1 min-w-[150px] items-center gap-1.5">
                <Label htmlFor="search-locality">Miejscowość</Label>
                <Select value={filters.locality as string} onValueChange={(v) => handleValueChange('locality', v)}>
                    <SelectTrigger id="search-locality"><SelectValue placeholder="Wszystkie miejscowości" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Wszystkie miejscowości</SelectItem>
                        {sortedLocalities.filter(Boolean).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center space-x-2 pb-2">
                <Switch 
                    id="show-available" 
                    checked={filters.showOnlyAvailable as boolean}
                    onCheckedChange={checked => handleValueChange('showOnlyAvailable', checked)}
                />
                <Label htmlFor="show-available">Tylko z wolnymi miejscami</Label>
            </div>
        </div>
    );
};


export default function HousingView({ currentUser }: { currentUser: SessionData }) {
    const { settings, handleEditEmployeeClick, handleEditNonEmployeeClick, handleUpdateSettings } = useMainLayout();
    const { isMobile } = useIsMobile();
    const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

    const [filters, setFilters] = useState({
        name: '',
        locality: 'all',
        showOnlyAvailable: false,
    });

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
            items = items.filter(item => (item.name || '').toLowerCase().includes(filters.name.toLowerCase()));
        }
        if (filters.locality !== 'all') {
            items = items.filter(item => item.locality === filters.locality);
        }
        if (filters.showOnlyAvailable) {
            items = items.filter(item => item.available > 0);
        }
        
        items.sort((a,b) => (a.name || '').localeCompare(b.name || ''));

        return items;
    }, [rawHousingData, filters]);

    const groupedByLocality = useMemo(() => {
        const grouped = filteredData.reduce((acc, address) => {
            const locality = address.locality || 'Inne';
            if (!acc[locality]) {
                acc[locality] = { addresses: [], availablePlaces: 0 };
            }
            acc[locality].addresses.push(address);
            return acc;
        }, {} as Record<string, { addresses: HousingData[]; availablePlaces: number }>);
        
        // Calculate available places per locality (only from active addresses/rooms)
        for (const locality in grouped) {
            grouped[locality].availablePlaces = grouped[locality].addresses.reduce((sum, address) => {
                if (address.name.toLowerCase().startsWith('własne mieszkanie')) {
                    return sum;
                }
                // Only count available places if address is active
                if (!address.isActive) {
                    return sum;
                }
                return sum + address.available;
            }, 0);
        }

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
    
    if (isMobile) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Zakwaterowanie</CardTitle>
                    <CardDescription>Przegląd adresów i mieszkańców</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="mb-4">
                        <FilterControls filters={filters} onFilterChange={handleFilterChange} settings={settings} currentUser={currentUser} />
                    </div>
                    <ScrollArea className="h-[calc(100vh-22rem)] -mx-4 px-4">
                        <Accordion type="multiple" className="w-full space-y-3">
                            {groupedByLocality.map(([locality, { addresses, availablePlaces }]) => (
                                <div key={locality}>
                                    <h2 className="text-lg font-bold sticky top-0 bg-background py-3 z-10 flex items-center">
                                        {locality}
                                        {availablePlaces > 0 && (
                                            <Badge variant="secondary" className="ml-2">{availablePlaces} wolnych</Badge>
                                        )}
                                    </h2>
                                    <div className="space-y-3">
                                        {addresses.map((address, index) => (
                                            <MobileAddressCard
                                                key={address.id}
                                                address={address}
                                                onOccupantClick={handleOccupantClick}
                                                currentUser={currentUser}
                                                settings={settings}
                                                handleUpdateSettings={handleUpdateSettings}
                                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </Accordion>
                    </ScrollArea>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full">
            <Card className="h-full">
                 <CardHeader className="p-4">
                    <CardTitle>Adresy</CardTitle>
                    <CardDescription>Wybierz adres, aby zobaczyć szczegóły.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="space-y-4 mb-4">
                        <FilterControls filters={filters} onFilterChange={handleFilterChange} settings={settings} currentUser={currentUser}/>
                    </div>
                    <ScrollArea className="h-[calc(100vh-25rem)] lg:h-[calc(100vh-24rem)]">
                        <Accordion type="multiple" className="w-full" defaultValue={groupedByLocality.map(g => g[0])} >
                             {groupedByLocality.map(([locality, { addresses, availablePlaces }]) => (
                                <AccordionItem value={locality} key={locality} className="border-b-0">
                                    <AccordionTrigger className="text-lg font-bold sticky top-0 bg-background py-3 z-10 hover:no-underline">
                                        <div className="flex items-center">
                                            {locality}
                                            {availablePlaces > 0 && (
                                                <Badge variant="secondary" className="ml-2">{availablePlaces} wolnych</Badge>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        {addresses.map((address, index) => (
                                            <Card 
                                                key={address.id}
                                                className={cn(
                                                    "cursor-pointer transition-colors animate-fade-in-up",
                                                    !address.isActive && "border-destructive/50 bg-destructive/10",
                                                    address.isActive && selectedAddressIds.includes(address.id) ? "bg-primary/10 border-primary" : address.isActive && "hover:bg-muted/50",
                                                    address.isActive && address.available > 0 && !selectedAddressIds.includes(address.id) && "bg-green-500/10 border-green-500/20"
                                                )}
                                                onClick={() => handleAddressClick(address.id)}
                                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                                            >
                                                <CardHeader className="p-2">
                                                    <div className="flex justify-between items-start">
                                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                            <Building className={cn("h-4 w-4", address.isActive ? "text-primary" : "text-destructive")} />
                                                            {address.name}
                                                            {!address.isActive && (
                                                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                                    <Lock className="h-3 w-3 mr-0.5" />
                                                                    Zablokowany
                                                                </Badge>
                                                            )}
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
        </div>
    );
}
