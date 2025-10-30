
"use client";

import React, { useState, useMemo } from 'react';
import type { Employee, NonEmployee, SessionData } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Users, Bed, Building, User, ArrowUpDown } from "lucide-react";
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useMainLayout } from '@/components/main-layout';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';


type Occupant = Employee | NonEmployee;
type HousingData = (ReturnType<typeof useHousingData>)[0];

const isEmployee = (occupant: Occupant): occupant is Employee => 'coordinatorId' in occupant;

const calculateStats = (occupants: Occupant[]) => {
    const stats = {
        nationalities: new Map<string, number>(),
        genders: new Map<string, number>(),
    };
    occupants.forEach(occ => {
        if (isEmployee(occ)) {
            stats.nationalities.set(occ.nationality, (stats.nationalities.get(occ.nationality) || 0) + 1);
            stats.genders.set(occ.gender, (stats.genders.get(occ.gender) || 0) + 1);
        }
    });
    return {
        nationalities: Array.from(stats.nationalities.entries()).map(([name, count]) => ({ name, count })),
        genders: Array.from(stats.genders.entries()).map(([name, count]) => ({ name, count })),
    };
};

const StatsList = ({ items }: { items: { name: string, count: number }[] }) => (
    <div className="flex flex-col text-xs">
        {items.length > 0 ? items.sort((a, b) => b.count - a.count).map(item => (
            <div key={item.name}>
                <span>{item.name} - </span>
                <span className="font-semibold">{item.count}</span>
            </div>
        )) : <span className="text-muted-foreground">-</span>}
    </div>
);

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
            const addressStats = calculateStats(occupantsInAddress);
            const totalCapacity = address.rooms.reduce((sum, room) => sum + room.capacity, 0);
            const occupantCount = occupantsInAddress.length;

            const rooms = address.rooms.map(room => {
                const occupantsInRoom = occupantsInAddress.filter(o => o.roomNumber === room.name);
                const roomStats = calculateStats(occupantsInRoom);
                return {
                    id: room.id,
                    name: room.name,
                    capacity: room.capacity,
                    occupants: occupantsInRoom,
                    occupantCount: occupantsInRoom.length,
                    available: room.capacity - occupantsInRoom.length,
                    ...roomStats
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
                ...addressStats,
                rooms: rooms
            };
        });

    }, [allEmployees, allNonEmployees, settings, currentUser, selectedCoordinatorId]);
}


export default function HousingView({ currentUser }: { currentUser: SessionData }) {
    const { handleEditEmployeeClick, handleEditNonEmployeeClick } = useMainLayout();
    const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: keyof HousingData | null; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
    const [filters, setFilters] = useState({ name: '', showOnlyAvailable: false });

    const rawHousingData = useHousingData();

    const toggleAddress = (addressId: string) => {
        setExpandedAddresses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(addressId)) {
                newSet.delete(addressId);
            } else {
                newSet.add(addressId);
            }
            return newSet;
        });
    };
    
    const handleOccupantClick = (occupant: Occupant) => {
        if (isEmployee(occupant)) {
            handleEditEmployeeClick(occupant);
        } else {
            handleEditNonEmployeeClick(occupant);
        }
    };
    
    const requestSort = (key: keyof HousingData) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredData = useMemo(() => {
        let sortableItems = [...rawHousingData];
        
        // Filtering
        if (filters.name) {
            sortableItems = sortableItems.filter(item => item.name.toLowerCase().includes(filters.name.toLowerCase()));
        }
        if (filters.showOnlyAvailable) {
            sortableItems = sortableItems.filter(item => item.available > 0);
        }

        // Sorting
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key!] < b[sortConfig.key!]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key!] > b[sortConfig.key!]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [rawHousingData, sortConfig, filters]);
    
    const getSortIndicator = (key: keyof HousingData) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };


    if (!rawHousingData) {
        return <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
    }

    const renderSortableHeader = (key: keyof HousingData, label: string) => (
        <TableHead className="text-center">
            <Button variant="ghost" onClick={() => requestSort(key)} className="px-2">
                {label}
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    )


    return (
        <Card>
            <CardHeader>
                <CardTitle>Przegląd zakwaterowania</CardTitle>
                <CardDescription>
                    Szczegółowy widok obłożenia adresów i pokoi z podziałem na narodowość i płeć.
                </CardDescription>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="search-address">Szukaj adresu</Label>
                        <Input 
                            id="search-address"
                            placeholder="Wpisz nazwę adresu..."
                            value={filters.name}
                            onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center space-x-2 pt-4 sm:pt-0">
                        <Switch 
                            id="show-available" 
                            checked={filters.showOnlyAvailable}
                            onCheckedChange={checked => setFilters(prev => ({...prev, showOnlyAvailable: checked}))}
                        />
                        <Label htmlFor="show-available">Tylko z wolnymi miejscami</Label>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-22rem)]">
                    <Table className="whitespace-nowrap">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>
                                     <Button variant="ghost" onClick={() => requestSort('name')} className="px-2">
                                        Adres / Pokój
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                {renderSortableHeader('occupantCount', 'Mieszkańcy')}
                                {renderSortableHeader('capacity', 'Miejsca')}
                                {renderSortableHeader('available', 'Wolne')}
                                <TableHead>Narodowość</TableHead>
                                <TableHead>Płeć</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredData.map(address => (
                                <React.Fragment key={address.id}>
                                    <TableRow className="bg-muted/50 font-semibold" onClick={() => toggleAddress(address.id)}>
                                        <TableCell>
                                            <Button variant="ghost" size="icon">
                                                {expandedAddresses.has(address.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Building className="h-4 w-4 text-primary" />
                                                <span>{address.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">{address.occupantCount}</TableCell>
                                        <TableCell className="text-center">{address.capacity}</TableCell>
                                        <TableCell className={cn("text-center font-bold", address.available > 0 ? "text-green-600" : "text-red-600")}>{address.available}</TableCell>
                                        <TableCell><StatsList items={address.nationalities} /></TableCell>
                                        <TableCell><StatsList items={address.genders} /></TableCell>
                                    </TableRow>
                                    {expandedAddresses.has(address.id) && (
                                        <>
                                            {address.rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(room => (
                                                <TableRow key={room.id} className="hover:bg-muted/20">
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-12">
                                                        <div className="flex items-center gap-2">
                                                            <Bed className="h-4 w-4 text-muted-foreground" />
                                                            <span>Pokój {room.name}</span>
                                                        </div>
                                                        <div className="pl-6 text-xs text-muted-foreground space-y-1 mt-1">
                                                        {room.occupants.map(o => (
                                                            <div key={o.id} onClick={() => handleOccupantClick(o)} className="flex items-center gap-2 cursor-pointer hover:text-primary">
                                                                <User className="h-3 w-3" />
                                                                {o.fullName}
                                                            </div>
                                                        ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">{room.occupantCount}</TableCell>
                                                    <TableCell className="text-center">{room.capacity}</TableCell>
                                                    <TableCell className={cn("text-center font-bold", room.available > 0 ? "text-green-600" : "text-red-600")}>{room.available}</TableCell>
                                                    <TableCell><StatsList items={room.nationalities} /></TableCell>
                                                    <TableCell><StatsList items={room.genders} /></TableCell>
                                                </TableRow>
                                            ))}
                                        </>
                                    )}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
