
"use client";

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart2 } from "lucide-react";
import type { Employee, Settings, Inspection } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMainLayout } from '@/components/main-layout';

const NoDataState = ({ message }: { message: string }) => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-border/50">
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm">{message}</p>
        </div>
    </div>
);

const calculateChartHeight = (itemCount: number, isMobile: boolean) => {
    const minHeight = 150;
    const heightPerItem = isMobile ? 30 : 35;
    const calculatedHeight = (isMobile ? 40 : 60) + (itemCount * heightPerItem);
    return Math.max(minHeight, calculatedHeight);
};

export function DashboardCharts({
    employees,
    settings,
    isMobile
}: {
    employees: Employee[],
    settings: Settings,
    isMobile: boolean
}) {
    const { currentUser, selectedCoordinatorId } = useMainLayout();
    const [_activeBar, setActiveBar] = useState<string | null>(null);

    const chartData = useMemo(() => {
        const activeEmployees = employees.filter(e => e.status === 'active');
        
        const employeesPerCoordinator = activeEmployees.reduce((acc, employee) => {
            const coordinatorName = settings.coordinators.find(c => c.uid === employee.coordinatorId)?.name || "Unassigned";
            if (!acc[coordinatorName]) {
                acc[coordinatorName] = { coordinator: coordinatorName, employees: 0 };
            }
            acc[coordinatorName].employees++;
            return acc;
        }, {} as Record<string, { coordinator: string, employees: number }>);
        
        const employeesByNationality = activeEmployees.reduce((acc, occupant) => {
            const nationality = occupant.nationality;
            if (nationality) {
                if (!acc[nationality]) {
                    acc[nationality] = { nationality, employees: 0 };
                }
                acc[nationality].employees++;
            }
            return acc;
        }, {} as Record<string, { nationality: string, employees: number }>);

        return {
            employeesPerCoordinator: Object.values(employeesPerCoordinator),
            employeesByNationality: Object.values(employeesByNationality).sort((a, b) => b.employees - a.employees),
        }
    }, [employees, settings]);

    const showCoordinatorChart = currentUser?.isAdmin && selectedCoordinatorId === 'all';

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {showCoordinatorChart && (
                <Card className="shadow-lg">
                    <CardHeader className='pb-2'>
                        <CardTitle className="text-lg">Pracownicy wg koordynatora</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {chartData.employeesPerCoordinator.length > 0 ? (
                            <ChartContainer config={{}} className="w-full" style={{ height: calculateChartHeight(chartData.employeesPerCoordinator.length, isMobile) }}>
                                <ResponsiveContainer>
                                    <BarChart 
                                        data={chartData.employeesPerCoordinator}
                                        layout="vertical"
                                        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                        barSize={15}
                                    >
                                        <defs>
                                            <linearGradient id="chart-coordinator-gradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                                        <YAxis dataKey="coordinator" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                                        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                                        <Tooltip cursor={false} content={<ChartTooltipContent />} />
                                        <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-coordinator-gradient)">
                                            <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        ) : (
                            <NoDataState message={'Brak danych do wyświetlenia na wykresie'} />
                        )}
                    </CardContent>
                </Card>
            )}
            <Card className="shadow-lg">
                <CardHeader className='pb-2'>
                    <CardTitle className="text-lg">Pracownicy wg narodowości</CardTitle>
                </CardHeader>
                <CardContent>
                    {chartData.employeesByNationality.length > 0 ? (
                        <ChartContainer config={{}} className="w-full" style={{ height: calculateChartHeight(chartData.employeesByNationality.length, isMobile) }}>
                            <ResponsiveContainer>
                                <BarChart 
                                    data={chartData.employeesByNationality} 
                                    layout="vertical"
                                    margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                    barSize={15}
                                >
                                    <defs>
                                        <linearGradient id="chart-nationality-gradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50"/>
                                    <YAxis dataKey="nationality" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                                    <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-nationality-gradient)">
                                        <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <NoDataState message={'Brak danych do wyświetlenia na wykresie'} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

  