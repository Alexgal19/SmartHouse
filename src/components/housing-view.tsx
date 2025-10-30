
"use client";

import React, { useState, useMemo } from 'react';
import type { Employee, NonEmployee, SessionData } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Users, Bed, Building, User } from "lucide-react";
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useMainLayout } from '@/components/main-layout';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';

type Occupant = Employee | NonEmployee;

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
        {items.sort((a, b) => b.count - a.count).map(item => (
            <div key={item.name}>
                <span>{item.name} - </span>
                <span className="font-semibold">{item.count}</span>
            </div>
        ))}
    </div>
);


export default function HousingView({ currentUser }: { currentUser: SessionData }) {
    const { allEmployees, allNonEmployees, settings, selectedCoordinatorId, handleEditEmployeeClick, handleEditNonEmployeeClick } = useMainLayout();
    const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());

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


    const housingData = useMemo(() => {
        if (!settings || !allEmployees || !allNonEmployees) return [];

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
                occupantCount: occupantsInAddress.length,
                capacity: totalCapacity,
                available: totalCapacity - occupantsInAddress.length,
                ...addressStats,
                rooms: rooms
            };
        }).sort((a,b) => a.name.localeCompare(b.name));

    }, [allEmployees, allNonEmployees, settings, currentUser, selectedCoordinatorId]);

    if (!settings || !allEmployees || !allNonEmployees) {
        return <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>Przegląd zakwaterowania</CardTitle>
                <CardDescription>
                    Szczegółowy widok obłożenia adresów i pokoi z podziałem na narodowość i płeć.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-16rem)]">
                    <Table className="whitespace-nowrap">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Adres / Pokój</TableHead>
                                <TableHead className="text-center">Mieszkańcy</TableHead>
                                <TableHead className="text-center">Miejsca</TableHead>
                                <TableHead className="text-center">Wolne</TableHead>
                                <TableHead>Narodowość</TableHead>
                                <TableHead>Płeć</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {housingData.map(address => (
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
                                        <TableCell className={cn("text-center", address.available > 0 ? "text-green-600" : "text-red-600")}>{address.available}</TableCell>
                                        <TableCell><StatsList items={address.nationalities} /></TableCell>
                                        <TableCell><StatsList items={address.genders} /></TableCell>
                                    </TableRow>
                                    {expandedAddresses.has(address.id) && (
                                        <>
                                            {address.rooms.map(room => (
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
                                                    <TableCell className={cn("text-center", room.available > 0 ? "text-green-600" : "text-red-600")}>{room.available}</TableCell>
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
