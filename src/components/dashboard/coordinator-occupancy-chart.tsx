
"use client";

import React, { useMemo } from 'react';
import type { Employee, NonEmployee } from "@/types";
import { useMainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip as RechartsTooltip, Cell } from "recharts";
import { BarChart2, BedDouble, UserRoundCheck, Users } from "lucide-react";
import { cn } from '@/lib/utils';
import { getActiveAddressCapacity } from '@/lib/address-filters';

type OccupancyData = {
    name: string;
    occupancy: number;
    occupantCount: number;
    capacity: number;
    available: number;
    isBlocked: boolean;
}

const NoDataState = ({ message, className }: { message: string, className?: string }) => (
    <div className={cn("flex h-full w-full min-h-[250px] items-center justify-center rounded-lg border border-dashed border-border/50", className)}>
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm">{message}</p>
        </div>
    </div>
);

const getOccupancyColor = (percentage: number, isBlocked: boolean) => {
    if (isBlocked) {
        return 'hsl(0 84% 60%)'; // red for blocked addresses
    }
    if (percentage < 30) {
        return 'hsl(var(--chart-5))'; // red
    }
    if (percentage < 70) {
        return 'hsl(var(--chart-1))'; // orange
    }
    return 'hsl(var(--chart-2))'; // green
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

    const chartData = useMemo(() => {
        if (!settings || !allEmployees || !allNonEmployees || selectedCoordinatorId === 'all') {
            return { data: [], coordinatorName: '', totals: null };
        }

        const coordinator = settings.coordinators.find(c => c.uid === selectedCoordinatorId);
        if (!coordinator) {
            return { data: [], coordinatorName: '', totals: null };
        }

        // Include ONLY active addresses. Blocked addresses are completely excluded from stats.
        const coordinatorAddresses = settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId) && a.isActive);

        const allActiveOccupants: (Employee | NonEmployee)[] = [
            ...allEmployees.filter(e => e.status === 'active'),
            ...allNonEmployees.filter(ne => ne.status === 'active')
        ];

        const occupancyByAddress: OccupancyData[] = coordinatorAddresses.map(address => {
            const isBlocked = !address.isActive;
            const occupantsInAddress = allActiveOccupants.filter(o => o.address === address.name);
            // Only count capacity from active (non-blocked) rooms
            const totalCapacity = getActiveAddressCapacity(address);
            const occupantCount = occupantsInAddress.length;
            const occupancy = totalCapacity > 0 ? (occupantCount / totalCapacity) * 100 : 0;

            return {
                name: address.name,
                occupancy: occupancy,
                occupantCount,
                capacity: totalCapacity,
                available: totalCapacity - occupantCount,
                isBlocked
            }
        }).sort((a, b) => b.occupancy - a.occupancy);

        const managedAddresses = occupancyByAddress.filter(
            (address) => !address.name.toLowerCase().startsWith('własne mieszkanie')
        );

        // Calculate totals 
        const totals = managedAddresses.reduce((acc, address) => {
            acc.capacity += address.capacity;
            acc.occupantCount += address.occupantCount;
            acc.available += address.available;
            return acc;
        }, { capacity: 0, occupantCount: 0, available: 0 });

        return { data: occupancyByAddress, coordinatorName: coordinator.name, totals };

    }, [allEmployees, allNonEmployees, settings, selectedCoordinatorId]);

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
                {chartData.totals && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <KpiCard
                            title="Wszystkie miejsca"
                            value={chartData.totals.capacity}
                            icon={<Users className="h-5 w-5 text-muted-foreground" />}
                        />
                        <KpiCard
                            title="Zajęte"
                            value={chartData.totals.occupantCount}
                            icon={<UserRoundCheck className="h-5 w-5 text-muted-foreground" />}
                        />
                        <KpiCard
                            title="Wolne"
                            value={chartData.totals.available}
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
                                margin={{ top: 5, right: 80, bottom: 5, left: 10 }}
                                barCategoryGap="25%"
                            >
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    width={200}
                                    className="text-xs"
                                    interval={0}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    tick={(props: any) => {
                                        const { x, y, payload } = props;
                                        const data = chartData.data.find(d => d.name === payload.value);
                                        const isBlocked = data?.isBlocked || false;
                                        const text = payload.value || '';

                                        // Truncate text if too long and add ellipsis
                                        const maxLength = 28;
                                        const displayText = text.length > maxLength
                                            ? text.substring(0, maxLength) + '...'
                                            : text;

                                        return (
                                            <g>
                                                <title>{text}</title>
                                                <text
                                                    x={x}
                                                    y={y}
                                                    dy={4}
                                                    textAnchor="end"
                                                    fill={isBlocked ? 'hsl(0 84% 60%)' : 'currentColor'}
                                                    className="text-xs"
                                                    style={{ opacity: isBlocked ? 0.7 : 1 }}
                                                >
                                                    {displayText}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                                <XAxis type="number" domain={[0, 100]} hide={true} />
                                <RechartsTooltip
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    content={(props: any) => {
                                        const { active, payload } = props;
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload as OccupancyData;
                                            return (
                                                <div className={cn(
                                                    "min-w-[12rem] rounded-lg border bg-background/95 p-2 text-sm shadow-xl",
                                                    data.isBlocked && "border-red-500"
                                                )}>
                                                    <div className="font-bold flex items-center gap-2">
                                                        {data.name}
                                                        {data.isBlocked && (
                                                            <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                                                                Zablokowany
                                                            </span>
                                                        )}
                                                    </div>
                                                    {data.isBlocked && (
                                                        <div className="mt-1 text-xs text-muted-foreground italic">
                                                            Ten adres jest nieaktywny
                                                        </div>
                                                    )}
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
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={getOccupancyColor(entry.occupancy, entry.isBlocked)}
                                            opacity={entry.isBlocked ? 0.5 : 1}
                                        />
                                    ))}
                                    <LabelList
                                        dataKey="occupancy"
                                        position="right"
                                        offset={10}
                                        className="fill-foreground text-xs font-medium"
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        content={(props: any) => {
                                            const { x, y, value, index, width } = props;
                                            const data = chartData.data[index as number];
                                            if (!data) return null;

                                            // Calculate position at the end of the bar
                                            const barEndX = Number(x) + Number(width || 0);

                                            return (
                                                <g>
                                                    <text
                                                        x={barEndX}
                                                        y={y}
                                                        dx={10}
                                                        dy={4}
                                                        textAnchor="start"
                                                        fill={data.isBlocked ? 'hsl(0 84% 60%)' : 'currentColor'}
                                                        className="text-xs font-medium"
                                                        style={{ opacity: data.isBlocked ? 0.7 : 1 }}
                                                    >
                                                        {data.isBlocked ? 'Zablokowany' : `${(value as number).toFixed(0)}%`}
                                                    </text>
                                                </g>
                                            );
                                        }}
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
