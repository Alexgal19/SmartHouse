
"use client";

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart2 } from "lucide-react";
import type { Employee, Settings } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMainLayout } from '@/components/main-layout';
import { format, getYear, eachDayOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pl } from 'date-fns/locale';

const NoDataState = ({ message }: { message: string }) => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-border/50">
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm">{message}</p>
        </div>
    </div>
);

export function DashboardCharts({
    employees,
    settings,
    isMobile: _isMobile,
}: {
    employees: Employee[],
    settings: Settings,
    isMobile: boolean
}) {
    const { currentUser, selectedCoordinatorId } = useMainLayout();

    const [departureYear, setDepartureYear] = useState(new Date().getFullYear());
    const [departureMonth, setDepartureMonth] = useState<number | 'all'>('all');
    const [deductionYear, setDeductionYear] = useState(new Date().getFullYear());
    const [deductionMonth, setDeductionMonth] = useState<number | 'all'>('all');

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
        
        const departuresByDate = employees.reduce((acc, employee) => {
            if (employee.checkOutDate) {
                const checkOut = new Date(employee.checkOutDate);
                const dateKey = format(checkOut, 'yyyy-MM-dd');
                 if (!acc[dateKey]) {
                    acc[dateKey] = { departures: 0 };
                }
                acc[dateKey].departures++;
            }
            return acc;
        }, {} as Record<string, { departures: number }>);
        
        let departuresData;
        if (departureMonth === 'all') {
            const yearStartDate = startOfYear(new Date(departureYear, 0, 1));
            const yearEndDate = endOfYear(new Date(departureYear, 11, 31));
            const monthsInYear = eachMonthOfInterval({ start: yearStartDate, end: yearEndDate });
            
            departuresData = monthsInYear.map(monthDate => {
                const monthKey = format(monthDate, 'yyyy-MM');
                const monthDepartures = Object.keys(departuresByDate).filter(dateKey => dateKey.startsWith(monthKey)).reduce((sum, dateKey) => sum + departuresByDate[dateKey].departures, 0);
                return {
                    label: format(monthDate, 'MMM', { locale: pl }),
                    departures: monthDepartures,
                }
            })

        } else {
            const monthStartDate = startOfMonth(new Date(departureYear, departureMonth - 1));
            const monthEndDate = endOfMonth(monthStartDate);
            const daysInMonth = eachDayOfInterval({start: monthStartDate, end: monthEndDate});

            departuresData = daysInMonth.map(dayDate => {
                const dayKey = format(dayDate, 'yyyy-MM-dd');
                return {
                    label: format(dayDate, 'd'),
                    departures: departuresByDate[dayKey]?.departures || 0,
                }
            })
        }

        const deductionsByDate = employees.reduce((acc, employee) => {
            if (employee.checkOutDate) {
                const totalDeduction = (employee.deductionRegulation || 0) +
                                     (employee.deductionNo4Months || 0) +
                                     (employee.deductionNo30Days || 0) +
                                     (employee.deductionReason || []).reduce((sum, reason) => sum + (reason.checked && reason.amount ? reason.amount : 0), 0);

                if (totalDeduction > 0) {
                    const dateKey = format(new Date(employee.checkOutDate), 'yyyy-MM-dd');
                    if (!acc[dateKey]) {
                        acc[dateKey] = { deductions: 0 };
                    }
                    acc[dateKey].deductions += totalDeduction;
                }
            }
            return acc;
        }, {} as Record<string, { deductions: number }>);
        
        let deductionsData;
        if (deductionMonth === 'all') {
            const yearStartDate = startOfYear(new Date(deductionYear, 0, 1));
            const yearEndDate = endOfYear(new Date(deductionYear, 11, 31));
            const monthsInYear = eachMonthOfInterval({ start: yearStartDate, end: yearEndDate });
            
            deductionsData = monthsInYear.map(monthDate => {
                const monthKey = format(monthDate, 'yyyy-MM');
                const monthDeductions = Object.keys(deductionsByDate).filter(dateKey => dateKey.startsWith(monthKey)).reduce((sum, dateKey) => sum + deductionsByDate[dateKey].deductions, 0);
                return {
                    label: format(monthDate, 'MMM', { locale: pl }),
                    deductions: monthDeductions,
                }
            });
        } else {
            const monthStartDate = startOfMonth(new Date(deductionYear, deductionMonth - 1));
            const monthEndDate = endOfMonth(monthStartDate);
            const daysInMonth = eachDayOfInterval({start: monthStartDate, end: monthEndDate});

            deductionsData = daysInMonth.map(dayDate => {
                const dayKey = format(dayDate, 'yyyy-MM-dd');
                return {
                    label: format(dayDate, 'd'),
                    deductions: deductionsByDate[dayKey]?.deductions || 0,
                }
            });
        }


        return {
            employeesPerCoordinator: Object.values(employeesPerCoordinator),
            employeesByNationality: Object.values(employeesByNationality).sort((a, b) => b.employees - a.employees),
            departuresByMonth: departuresData,
            deductionsByDate: deductionsData,
        }
    }, [employees, settings, departureYear, departureMonth, deductionYear, deductionMonth]);

    const showCoordinatorChart = currentUser?.isAdmin && selectedCoordinatorId === 'all';
    
    const availableYears = useMemo(() => Array.from(new Set(employees.filter(e => e.checkOutDate).map(e => getYear(new Date(e.checkOutDate!))))).sort((a,b) => b-a), [employees]);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    const calculateChartHeight = (dataLength: number) => {
        if (dataLength === 0) return 150;
        const minHeight = 150;
        const rowHeight = 35;
        const calculatedHeight = dataLength * rowHeight + 50; // 50 for padding
        return Math.max(minHeight, calculatedHeight);
    };

    return (
        <div className="grid gap-6">
            {showCoordinatorChart && chartData.employeesPerCoordinator.length > 0 && (
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className="text-lg">Pracownicy wg koordynatora</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} style={{ height: `${calculateChartHeight(chartData.employeesPerCoordinator.length)}px` }}>
                            <BarChart 
                                data={chartData.employeesPerCoordinator}
                                layout="vertical"
                                margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                barSize={15}
                            >
                                <defs>
                                    <linearGradient id="chart-coordinator-gradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
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
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}
            {chartData.employeesByNationality.length > 0 && (
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className="text-lg">Pracownicy wg narodowości</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} style={{ height: `${calculateChartHeight(chartData.employeesByNationality.length)}px` }}>
                            <BarChart 
                                data={chartData.employeesByNationality} 
                                layout="vertical"
                                margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                barSize={15}
                            >
                                <defs>
                                    <linearGradient id="chart-nationality-gradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
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
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}
           
            <Card>
                <CardHeader className='pb-2'>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                         <div>
                            <CardTitle className="text-lg">Statystyka wyjazdów</CardTitle>
                         </div>
                         <div className="flex items-center gap-2 pt-2 sm:pt-0">
                             <Select value={String(departureYear)} onValueChange={(v) => setDepartureYear(Number(v))}>
                                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                </SelectContent>
                             </Select>
                             <Select value={String(departureMonth)} onValueChange={(v) => setDepartureMonth(v === 'all' ? 'all' : Number(v))}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Wszystkie miesiące</SelectItem>
                                    {months.map(m => <SelectItem key={m} value={String(m)}>{format(new Date(departureYear, m-1), 'LLLL', {locale: pl})}</SelectItem>)}
                                </SelectContent>
                             </Select>
                         </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {chartData.departuresByMonth.length > 0 ? (
                         <ChartContainer config={{}} className="w-full h-64">
                            <ResponsiveContainer>
                                <BarChart 
                                    data={chartData.departuresByMonth}
                                    margin={{ top: 20, right: 20, bottom: 5, left: 0 }}
                                >
                                     <defs>
                                        <linearGradient id="chart-departures-gradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50"/>
                                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                                    <Bar dataKey="departures" radius={[4, 4, 0, 0]} fill="url(#chart-departures-gradient)">
                                       <LabelList dataKey="departures" position="top" offset={8} className="fill-foreground text-xs" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <NoDataState message={'Brak danych do wyświetlenia na wykresie'} />
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader className='pb-2'>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                         <div>
                            <CardTitle className="text-lg">Potrącenia</CardTitle>
                         </div>
                         <div className="flex items-center gap-2 pt-2 sm:pt-0">
                             <Select value={String(deductionYear)} onValueChange={(v) => setDeductionYear(Number(v))}>
                                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                </SelectContent>
                             </Select>
                             <Select value={String(deductionMonth)} onValueChange={(v) => setDeductionMonth(v === 'all' ? 'all' : Number(v))}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Wszystkie miesiące</SelectItem>
                                    {months.map(m => <SelectItem key={m} value={String(m)}>{format(new Date(deductionYear, m-1), 'LLLL', {locale: pl})}</SelectItem>)}
                                </SelectContent>
                             </Select>
                         </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {chartData.deductionsByDate.length > 0 ? (
                         <ChartContainer config={{}} className="w-full h-64">
                            <ResponsiveContainer>
                                <BarChart 
                                    data={chartData.deductionsByDate}
                                    margin={{ top: 20, right: 20, bottom: 5, left: 0 }}
                                >
                                     <defs>
                                        <linearGradient id="chart-deductions-gradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50"/>
                                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={false} content={<ChartTooltipContent formatter={(value) => `${value} PLN`}/>} />
                                    <Bar dataKey="deductions" radius={[4, 4, 0, 0]} fill="url(#chart-deductions-gradient)">
                                       <LabelList dataKey="deductions" position="top" offset={8} className="fill-foreground text-xs" formatter={(value: number) => value > 0 ? `${value}` : ''}/>
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <NoDataState message={'Brak danych o potrąceniach w wybranym okresie'} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
