
"use client";

import React, { useMemo } from 'react';
import type { Employee, NonEmployee, Settings, ChartConfig } from "@/types";
import { useMainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip as RechartsTooltip, Cell } from "recharts";
import { BarChart2, BedDouble, UserRoundCheck, Users } from "lucide-react";
import { cn } from '@/lib/utils';

type OccupancyData = {
    name: string;
    occupancy: number;
    occupantCount: number;
    capacity: number;
    available: number;
}

const NoDataState = ({ message, className }: { message: string, className?: string }) => (
    <div className={cn("flex h-full w-full min-h-[250px] items-center justify-center rounded-lg border border-dashed border-border/50", className)}>
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm">{message}</p>
        </div>
    </div>
);

const getOccupancyColor = (percentage: number) => {
    if (percentage > 70) {
        return 'hsl(var(--chart-2))'; // green
    }
    if (percentage > 30) {
        return 'hsl(var(--chart-1))'; // orange
    }
    return 'hsl(var(--chart-5))'; // red
};

const KpiCard = ({ title, value, icon, description }: { title: string; value: string | number; icon: React.ReactNode; description?: string; }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export function CoordinatorOccupancyChart() {
    const { allEmployees, allNonEmployees, settings, selectedCoordinatorId } = useMainLayout();

    const { data, coordinatorName, totals } = useMemo(() => {
        if (!settings || !allEmployees || !allNonEmployees || selectedCoordinatorId === 'all') {
            return { data: [], coordinatorName: '', totals: null };
        }

        const coordinator = settings.coordinators.find(c => c.uid === selectedCoordinatorId);
        if (!coordinator) {
            return { data: [], coordinatorName: '', totals: null };
        }
        
        const coordinatorAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId));

        const allActiveOccupants: (Employee | NonEmployee)[] = [
            ...allEmployees.filter(e => e.status === 'active'),
            ...allNonEmployees.filter(ne => ne.status === 'active')
        ];

        const occupancyByAddress: OccupancyData[] = coordinatorAddresses.map(address => {
            const occupantsInAddress = allActiveOccupants.filter(o => o.address === address.name);
            const totalCapacity = address.rooms.reduce((sum, room) => sum + room.capacity, 0);
            const occupantCount = occupantsInAddress.length;
            const occupancy = totalCapacity > 0 ? (occupantCount / totalCapacity) * 100 : 0;
            
            return {
                name: address.name,
                occupancy: occupancy,
                occupantCount,
                capacity: totalCapacity,
                available: totalCapacity - occupantCount
            }
        }).sort((a,b) => b.occupancy - a.occupancy);
        
        const totals = occupancyByAddress.reduce((acc, address) => {
            acc.capacity += address.capacity;
            acc.occupantCount += address.occupantCount;
            acc.available += address.available;
            return acc;
        }, { capacity: 0, occupantCount: 0, available: 0 });

        return { data: occupancyByAddress, coordinatorName: coordinator.name, totals };

    }, [allEmployees, allNonEmployees, settings, selectedCoordinatorId]);

     const chartConfig = {
      occupancy: {
        label: "Obłożenie (%)",
      },
    } satisfies ChartConfig;

    if (!chartData.coordinatorName || chartData.data.length === 0) {
        return null;
    }

    return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4">
            <CardHeader>
                <CardTitle>Obłożenie dla koordynatora</CardTitle>
                <CardDescription>Procentowe obłożenie adresów przypisanych do: <span className="font-bold text-primary">{chartData.coordinatorName}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {totals && (
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <KpiCard
                            title="Wszystkie miejsca"
                            value={totals.capacity}
                            icon={<Users className="h-5 w-5 text-muted-foreground" />}
                        />
                        <KpiCard
                            title="Zajęte"
                            value={totals.occupantCount}
                            icon={<UserRoundCheck className="h-5 w-5 text-muted-foreground" />}
                        />
                        <KpiCard
                            title="Wolne"
                            value={totals.available}
                            icon={<BedDouble className="h-5 w-5 text-muted-foreground" />}
                        />
                    </div>
                )}
                {chartData.data.every(d => d.capacity === 0) ? (
                    <NoDataState message="Brak zdefiniowanej pojemności dla adresów tego koordynatora." />
                ) : (
                    <div style={{ height: `${chartData.data.length * 40 + 60}px` }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData.data}
                                layout="vertical"
                                margin={{ top: 5, right: 50, bottom: 5, left: 10 }}
                                barCategoryGap="25%"
                            >
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                                <XAxis type="number" domain={[0, 100]} hide={true} />
                                <RechartsTooltip 
                                    cursor={{fill: 'hsl(var(--muted))'}} 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload as OccupancyData;
                                            return (
                                                <div className="min-w-[12rem] rounded-lg border bg-background/95 p-2 text-sm shadow-xl">
                                                    <div className="font-bold">{data.name}</div>
                                                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                                                        <span className="text-muted-foreground">Zajęte:</span>
                                                        <span>{data.occupantCount}</span>
                                                        <span className="text-muted-foreground">Pojemność:</span>
                                                        <span>{data.capacity}</span>
                                                        <span className="text-muted-foreground">Wolne:</span>
                                                        <span>{data.available}</span>
                                                        <span className="text-muted-foreground">Obłożenie:</span>
                                                        <span className="font-bold">{data.occupancy.toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="occupancy" radius={[0, 4, 4, 0]}>
                                     {chartData.data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getOccupancyColor(entry.occupancy)} />
                                    ))}
                                    <LabelList 
                                        dataKey="occupancy" 
                                        position="right" 
                                        offset={8} 
                                        className="fill-foreground text-xs"
                                        formatter={(value: number) => `${value.toFixed(0)}%`}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
