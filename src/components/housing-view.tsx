
"use client";

import React, { useState, useMemo } from 'react';
import type { Employee, NonEmployee, SessionData, Address } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Users, Bed, Building, User, ArrowUpDown, BarChart2 } from "lucide-react";
import { useMainLayout } from '@/components/main-layout';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, LabelList } from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";


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
        nationalities: Array.from(stats.nationalities.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        genders: Array.from(stats.genders.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    };
};

const NoDataState = ({ message }: { message: string }) => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 min-h-[150px]">
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs">{message}</p>
        </div>
    </div>
);


const HousingStatsCharts = ({ occupants, title }: { occupants: Occupant[], title: string }) => {
    const { nationalities, genders } = useMemo(() => calculateStats(occupants), [occupants]);
    
    const chartConfig = {
        count: { label: "Ilość" },
        nationalities: { color: "hsl(var(--chart-2))" },
        genders: { color: "hsl(var(--chart-1))" },
    } as ChartConfig;

    const nationalityChartHeight = nationalities.length > 0 ? `${nationalities.length * 30 + 40}px` : '150px';
    const genderChartHeight = genders.length > 0 ? `${genders.length * 35 + 40}px` : '150px';


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Statystyka</CardTitle>
                    <CardDescription>{title}</CardDescription>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Wg narodowości</CardTitle>
                </CardHeader>
                <CardContent>
                    {nationalities.length > 0 ? (
                        <ChartContainer config={chartConfig} style={{ height: nationalityChartHeight }}>
                            <BarChart data={nationalities} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={80} className="text-xs" interval={0} />
                                <XAxis type="number" hide />
                                <RechartsTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="count" fill="var(--color-nationalities)" radius={[0, 4, 4, 0]}>
                                   <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : <NoDataState message="Brak danych do wyświetlenia" />}
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Wg płci</CardTitle>
                </CardHeader>
                <CardContent>
                    {genders.length > 0 ? (
                        <ChartContainer config={chartConfig} style={{ height: genderChartHeight }}>
                            <BarChart data={genders} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={80} className="text-xs" interval={0} />
                                <XAxis type="number" hide />
                                <RechartsTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="count" fill="var(--color-genders)" radius={[0, 4, 4, 0]}>
                                     <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : <NoDataState message="Brak danych do wyświetlenia" />}
                </CardContent>
            </Card>
        </div>
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

            const rooms = address.rooms.map(room => {
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


export default function HousingView({ }: { currentUser: SessionData }) {
    const { settings, handleEditEmployeeClick, handleEditNonEmployeeClick } = useMainLayout();
    const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
    const [selectedAddressIdForStats, setSelectedAddressIdForStats] = useState<string | null>(null);

    const [sortConfig, setSortConfig] = useState<{ key: keyof HousingData | null; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
    const [filters, setFilters] = useState({
        name: '',
        showOnlyAvailable: false,
        nationality: 'all',
        gender: 'all',
    });

    const rawHousingData = useHousingData();

    const toggleAddressExpansion = (addressId: string) => {
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

    const handleRowClick = (addressId: string) => {
        toggleAddressExpansion(addressId);
        setSelectedAddressIdForStats(prev => (prev === addressId ? null : addressId));
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
    
    const handleFilterChange = (key: string, value: string | boolean) => {
        setFilters(prev => ({...prev, [key]: value}));
        setSelectedAddressIdForStats(null); // Reset selected address on filter change
    }

    const sortedAndFilteredData = useMemo(() => {
        let sortableItems = [...rawHousingData];
        
        // Filtering
        if (filters.name) {
            sortableItems = sortableItems.filter(item => item.name.toLowerCase().includes(filters.name.toLowerCase()));
        }
        if (filters.showOnlyAvailable) {
            sortableItems = sortableItems.filter(item => item.available > 0);
        }
        if (filters.nationality !== 'all') {
            sortableItems = sortableItems.filter(item => 
                item.occupants.some(occ => isEmployee(occ) && occ.nationality === filters.nationality)
            );
        }
        if (filters.gender !== 'all') {
            sortableItems = sortableItems.filter(item => 
                item.occupants.some(occ => isEmployee(occ) && occ.gender === filters.gender)
            );
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
    
    const occupantsForCharts = useMemo(() => {
        if (selectedAddressIdForStats) {
            const selectedAddress = sortedAndFilteredData.find(addr => addr.id === selectedAddressIdForStats);
            return selectedAddress ? selectedAddress.occupants : [];
        }
        return sortedAndFilteredData.flatMap(address => address.occupants);
    }, [sortedAndFilteredData, selectedAddressIdForStats]);

    const chartTitle = useMemo(() => {
        if (selectedAddressIdForStats) {
            const selectedAddress = sortedAndFilteredData.find(addr => addr.id === selectedAddressIdForStats);
            return selectedAddress ? `Dla adresu: ${selectedAddress.name}` : 'Statystyka globalna';
        }
        return 'Statystyka dla wszystkich odfiltrowanych adresów';
    }, [selectedAddressIdForStats, sortedAndFilteredData]);
    
    if (!rawHousingData || !settings) {
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Przegląd zakwaterowania</CardTitle>
                        <CardDescription>
                            Szczegółowy widok obłożenia adresów i pokoi. Kliknij na adres, aby zobaczyć statystyki po prawej.
                        </CardDescription>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 flex-wrap">
                            <div className="grid w-full sm:w-auto items-center gap-1.5">
                                <Label htmlFor="search-address">Szukaj adresu</Label>
                                <Input 
                                    id="search-address"
                                    placeholder="Wpisz nazwę adresu..."
                                    value={filters.name}
                                    onChange={e => handleFilterChange('name', e.target.value)}
                                    className="w-full sm:w-48"
                                />
                            </div>
                            <div className="grid w-full sm:w-auto items-center gap-1.5">
                                <Label>Narodowość</Label>
                                <Select value={filters.nationality} onValueChange={(v) => handleFilterChange('nationality', v)}>
                                    <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Wszystkie</SelectItem>
                                        {settings.nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid w-full sm:w-auto items-center gap-1.5">
                                <Label>Płeć</Label>
                                <Select value={filters.gender} onValueChange={(v) => handleFilterChange('gender', v)}>
                                    <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Wszystkie</SelectItem>
                                        {settings.genders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-4 sm:pt-6">
                                <Switch 
                                    id="show-available" 
                                    checked={filters.showOnlyAvailable}
                                    onCheckedChange={checked => handleFilterChange('showOnlyAvailable', checked)}
                                />
                                <Label htmlFor="show-available">Tylko z wolnymi miejscami</Label>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[calc(100vh-25rem)]">
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedAndFilteredData.map(address => (
                                        <React.Fragment key={address.id}>
                                            <TableRow 
                                                className={cn(
                                                    "font-semibold cursor-pointer",
                                                    selectedAddressIdForStats === address.id ? "bg-primary/10 hover:bg-primary/20" : "bg-muted/50 hover:bg-muted"
                                                )}
                                                onClick={() => handleRowClick(address.id)}
                                            >
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="w-8 h-8">
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
                                            </TableRow>
                                            {expandedAddresses.has(address.id) && (
                                            <TableRow>
                                                    <TableCell colSpan={5} className="p-0">
                                                        <div className="p-4 bg-background">
                                                            <h4 className="font-medium text-sm mb-2 pl-12">Pokoje</h4>
                                                            {address.rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(room => (
                                                                <div key={room.id} className="hover:bg-muted/50 rounded-md p-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="pl-10 flex items-center gap-2">
                                                                            <Bed className="h-4 w-4 text-muted-foreground" />
                                                                            <span>Pokój {room.name}</span>
                                                                        </div>
                                                                        <div className="flex gap-4 text-center text-xs">
                                                                            <span className="w-12">{room.occupantCount}</span>
                                                                            <span className="w-12">{room.capacity}</span>
                                                                            <span className={cn("w-12 font-bold", room.available > 0 ? "text-green-600" : "text-red-600")}>{room.available}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="pl-16 text-xs text-muted-foreground space-y-1 mt-1">
                                                                        {room.occupants.map(o => (
                                                                            <div key={o.id} onClick={() => handleOccupantClick(o)} className="flex items-center gap-2 cursor-pointer hover:text-primary">
                                                                                <User className="h-3 w-3" />
                                                                                {o.fullName}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <HousingStatsCharts occupants={occupantsForCharts} title={chartTitle}/>
            </div>
        </div>
    );
}

    