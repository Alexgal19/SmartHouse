
"use client";

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart2, Copy, Users, ArrowLeft } from "lucide-react";
import type { Employee, Settings, ChartConfig, Coordinator, Address, NonEmployee } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMainLayout } from '@/components/main-layout';
import { format, getYear, eachDayOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pl } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Combobox } from '../ui/combobox';
import { Label } from '../ui/label';

const NoDataState = ({ message }: { message: string }) => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-border/50">
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm">{message}</p>
        </div>
    </div>
);

const EmployeeListDialog = ({
    isOpen,
    onOpenChange,
    departmentName,
    employees
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    departmentName: string;
    employees: Employee[];
}) => {
    const { copyToClipboard } = useCopyToClipboard();

    const handleCopy = () => {
        const textToCopy = employees.map(e => e.fullName).join('\n');
        copyToClipboard(textToCopy, `Skopiowano listę pracowników z zakładu ${departmentName}.`);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pracownicy w: {departmentName}</DialogTitle>
                    <DialogDescription>
                        Lista pracowników przypisanych do tego zakładu.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-72">
                    <div className="space-y-2 pr-6">
                        {employees.map(employee => (
                            <div key={employee.id} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted/50">
                               <div className="flex items-center gap-2">
                                 <Users className="h-4 w-4 text-muted-foreground" />
                                 <span>{employee.fullName}</span>
                               </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                 <Button onClick={handleCopy} className="mt-4 w-full">
                    <Copy className="mr-2 h-4 w-4" />
                    Kopiuj listę
                </Button>
            </DialogContent>
        </Dialog>
    )
}

export function DashboardCharts({
    employees,
    nonEmployees,
    settings,
}: {
    employees: Employee[],
    nonEmployees: NonEmployee[],
    settings: Settings,
    isMobile: boolean
}) {
    const { currentUser, selectedCoordinatorId } = useMainLayout();

    const [departureYear, setDepartureYear] = useState(new Date().getFullYear());
    const [departureMonth, setDepartureMonth] = useState<number | 'all'>('all');
    
    const [deductionYear, setDeductionYear] = useState(new Date().getFullYear());
    const [deductionMonth, setDeductionMonth] = useState<number | 'all'>('all');
    const [deductionLocality, setDeductionLocality] = useState('all');
    const [deductionAddress, setDeductionAddress] = useState('all');
    const [deductionEmployee, setDeductionEmployee] = useState('all');

    const [isEmployeeListDialogOpen, setIsEmployeeListDialogOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<{name: string, employees: Employee[]}>({name: '', employees: []});
    
    const [departmentChartFilter, setDepartmentChartFilter] = useState('all');
    const [departmentChartSort, setDepartmentChartSort] = useState<'count' | 'name'>('count');
    
    const [nationalityChartFilter, setNationalityChartFilter] = useState('all');
    const [nationalityChartSort, setNationalityChartSort] = useState<'count' | 'name'>('count');
    
    const [coordinatorChartFilter, setCoordinatorChartFilter] = useState('all');
    const [coordinatorChartSort, setCoordinatorChartSort] = useState<'count' | 'name'>('count');

    const [nzIncomeView, setNzIncomeView] = useState<{level: 'localities' | 'addresses', filter: string | null}>({ level: 'localities', filter: null });


    const chartConfig = {
      employees: {
        label: "Employees",
        color: "hsl(var(--chart-1))",
      },
       departures: {
        label: "Departures",
        color: "hsl(var(--chart-4))",
      },
       deductions: {
        label: "Deductions",
        color: "hsl(var(--chart-5))",
      },
      departments: {
        label: "Zakłady",
        color: "hsl(var(--chart-3))",
      },
      nationalities: {
        label: "Nationalities",
        color: "hsl(var(--chart-2))",
      },
      coordinators: {
          label: "Coordinators",
          color: "hsl(var(--chart-1))"
      },
      nzIncome: {
        label: "Przychód (NZ)",
        color: "hsl(var(--chart-2))"
      }
    } satisfies ChartConfig

    const deductionsFilteredAddresses = useMemo(() => {
        if (deductionLocality === 'all') {
            return settings.addresses;
        }
        return settings.addresses.filter(a => a.locality === deductionLocality);
    }, [settings.addresses, deductionLocality]);

    const chartData = useMemo(() => {
        const activeEmployees = employees.filter(e => e.status === 'active');
        
        const employeesPerCoordinatorSource = activeEmployees.reduce((acc, employee) => {
            const coordinatorName = settings.coordinators.find(c => c.uid === employee.coordinatorId)?.name || "Unassigned";
            if (!acc[coordinatorName]) {
                acc[coordinatorName] = { coordinator: coordinatorName, employees: 0 };
            }
            acc[coordinatorName].employees++;
            return acc;
        }, {} as Record<string, { coordinator: string, employees: number }>);
        
        let employeesPerCoordinator = Object.values(employeesPerCoordinatorSource);
        if(coordinatorChartFilter !== 'all') {
            const selectedCoordinator = settings.coordinators.find(c => c.uid === coordinatorChartFilter);
            if(selectedCoordinator) {
                employeesPerCoordinator = employeesPerCoordinator.filter(c => c.coordinator === selectedCoordinator.name);
            }
        }
        if (coordinatorChartSort === 'count') {
            employeesPerCoordinator.sort((a,b) => b.employees - a.employees);
        } else {
            employeesPerCoordinator.sort((a,b) => a.coordinator.localeCompare(b.coordinator));
        }
        
        const employeesByNationalitySource = activeEmployees.reduce((acc, occupant) => {
            const nationality = occupant.nationality;
            if (nationality) {
                if (!acc[nationality]) {
                    acc[nationality] = { nationality, employees: 0 };
                }
                acc[nationality].employees++;
            }
            return acc;
        }, {} as Record<string, { nationality: string, employees: number }>);
        
        let employeesByNationality = Object.values(employeesByNationalitySource);
        if(nationalityChartFilter !== 'all') {
            employeesByNationality = employeesByNationality.filter(n => n.nationality === nationalityChartFilter);
        }
        if(nationalityChartSort === 'count') {
            employeesByNationality.sort((a,b) => b.employees - a.employees);
        } else {
            employeesByNationality.sort((a,b) => a.nationality.localeCompare(b.nationality));
        }

        const employeesByDepartmentSource = activeEmployees.reduce((acc, employee) => {
            const department = employee.zaklad || "Brak zakładu";
            if (!acc[department]) {
                acc[department] = { department, employees: 0 };
            }
            acc[department].employees++;
            return acc;
        }, {} as Record<string, { department: string, employees: number}>);
        
        let employeesByDepartment = Object.values(employeesByDepartmentSource);
        
        if (departmentChartFilter !== 'all') {
            employeesByDepartment = employeesByDepartment.filter(d => d.department === departmentChartFilter);
        }

        if (departmentChartSort === 'count') {
            employeesByDepartment.sort((a, b) => b.employees - a.employees);
        } else {
            employeesByDepartment.sort((a, b) => a.department.localeCompare(b.department));
        }

        const departuresByDate = employees.reduce((acc, employee) => {
            if (employee.checkOutDate) {
                try {
                    const checkOut = parseISO(employee.checkOutDate);
                    const dateKey = format(checkOut, 'yyyy-MM-dd');
                    if (!acc[dateKey]) {
                        acc[dateKey] = { departures: 0 };
                    }
                    acc[dateKey].departures++;
                } catch(e) {
                    console.warn(`Invalid checkout date for employee ${employee.id}: ${employee.checkOutDate}`);
                }
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
        
        let filteredDeductionEmployees = employees;
        if (deductionLocality !== 'all') {
            const addressesInLocality = new Set(settings.addresses.filter(a => a.locality === deductionLocality).map(a => a.name));
            filteredDeductionEmployees = filteredDeductionEmployees.filter(e => e.address && addressesInLocality.has(e.address));
        }
        if (deductionAddress !== 'all') {
             filteredDeductionEmployees = filteredDeductionEmployees.filter(e => e.address === deductionAddress);
        }
        if (deductionEmployee !== 'all') {
            filteredDeductionEmployees = filteredDeductionEmployees.filter(e => e.id === deductionEmployee);
        }


        const deductionsByDate = filteredDeductionEmployees.reduce((acc, employee) => {
            if (employee.checkOutDate) {
                const totalDeduction = (employee.deductionRegulation || 0) +
                                     (employee.deductionNo4Months || 0) +
                                     (employee.deductionNo30Days || 0) +
                                     (employee.deductionReason || []).reduce((sum, reason) => sum + (reason.checked && reason.amount ? reason.amount : 0), 0);

                if (totalDeduction > 0) {
                     try {
                        const dateKey = format(parseISO(employee.checkOutDate), 'yyyy-MM-dd');
                        if (!acc[dateKey]) {
                            acc[dateKey] = { deductions: 0 };
                        }
                        acc[dateKey].deductions += totalDeduction;
                    } catch(e) {
                         console.warn(`Invalid checkout date for deduction for employee ${employee.id}: ${employee.checkOutDate}`);
                    }
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
        
        const incomeByLocation = (nonEmployees || []).reduce((acc, nonEmployee) => {
            if (!nonEmployee.address) return acc;
            
            const addressInfo = settings.addresses.find(a => a.name === nonEmployee.address);
            if (!addressInfo) return acc;
            
            const locality = addressInfo.locality || "Brak miejscowości";
            const amount = nonEmployee.paymentAmount || (nonEmployee.gender === 'Dzieci' ? 600 : 900);
            
            if (!acc.byLocality[locality]) {
                acc.byLocality[locality] = { name: locality, income: 0, addresses: {} };
            }
            acc.byLocality[locality].income += amount;
            
            if (!acc.byLocality[locality].addresses[addressInfo.name]) {
                acc.byLocality[locality].addresses[addressInfo.name] = { name: addressInfo.name, income: 0 };
            }
            acc.byLocality[locality].addresses[addressInfo.name].income += amount;
            
            return acc;
        }, { byLocality: {} as Record<string, { name: string, income: number, addresses: Record<string, {name: string, income: number}> }> });

        let nzIncomeChartData;
        if (nzIncomeView.level === 'localities') {
            nzIncomeChartData = Object.values(incomeByLocation.byLocality)
                .map(l => ({ name: l.name, nzIncome: l.income }))
                .sort((a,b) => b.nzIncome - a.nzIncome);
        } else {
            const localityData = incomeByLocation.byLocality[nzIncomeView.filter || ''];
            if (localityData) {
                nzIncomeChartData = Object.values(localityData.addresses)
                    .map(a => ({ name: a.name, nzIncome: a.income }))
                    .sort((a,b) => b.nzIncome - a.nzIncome);
            } else {
                nzIncomeChartData = [];
            }
        }


        return {
            employeesPerCoordinator: employeesPerCoordinator,
            employeesByNationality: employeesByNationality,
            employeesByDepartment: employeesByDepartment,
            departuresByMonth: departuresData,
            deductionsByDate: deductionsData,
            nzIncomeByLocation: nzIncomeChartData,
        }
    }, [employees, nonEmployees, settings, departureYear, departureMonth, deductionYear, deductionMonth, departmentChartFilter, departmentChartSort, nationalityChartFilter, nationalityChartSort, coordinatorChartFilter, coordinatorChartSort, deductionLocality, deductionAddress, deductionEmployee, nzIncomeView]);

    const showCoordinatorChart = currentUser?.isAdmin && selectedCoordinatorId === 'all';
    
    const availableYears = useMemo(() => {
        const years = new Set(employees.filter(e => e.checkOutDate).map(e => {
            try {
                return getYear(parseISO(e.checkOutDate!))
            } catch {
                return new Date().getFullYear();
            }
        }));
        if (years.size === 0) {
            return [new Date().getFullYear()];
        }
        return Array.from(years).sort((a,b) => b-a)
    }, [employees]);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const handleDepartmentClick = (data: any) => {
        const departmentName = data.department;
        const departmentEmployees = employees.filter(e => (e.zaklad || "Brak zakładu") === departmentName && e.status === 'active');
        setSelectedDepartment({ name: departmentName, employees: departmentEmployees });
        setIsEmployeeListDialogOpen(true);
    };

    const handleNzIncomeClick = (data: any) => {
        if (nzIncomeView.level === 'localities') {
            setNzIncomeView({ level: 'addresses', filter: data.name });
        }
    };

    const departmentOptions = useMemo(() => {
        const options = settings.departments.map(d => ({ value: d, label: d }));
        options.unshift({ value: 'all', label: 'Wszystkie zakłady' });
        return options;
    }, [settings.departments]);

    const nationalityOptions = useMemo(() => {
        const options = settings.nationalities.map(n => ({ value: n, label: n}));
        options.unshift({ value: 'all', label: 'Wszystkie narodowości'});
        return options;
    }, [settings.nationalities]);
    
    const coordinatorOptions = useMemo(() => {
        const options = settings.coordinators.map((c: Coordinator) => ({ value: c.uid, label: c.name}));
        options.unshift({ value: 'all', label: 'Wszyscy koordynatorzy' });
        return options;
    }, [settings.coordinators]);

    const localitiesOptions = useMemo(() => {
        const options = settings.localities.map(l => ({ value: l, label: l }));
        options.unshift({ value: 'all', label: 'Wszystkie miejscowości' });
        return options;
    }, [settings.localities]);

    const addressesOptions = useMemo(() => {
        const options = deductionsFilteredAddresses.map((a: Address) => ({ value: a.name, label: a.name }));
        options.unshift({ value: 'all', label: 'Wszystkie adresy' });
        return options;
    }, [deductionsFilteredAddresses]);

    const employeeOptions = useMemo(() => {
        const options = employees.map((e: Employee) => ({ value: e.id, label: e.fullName }));
        options.unshift({ value: 'all', label: 'Wszyscy pracownicy' });
        return options;
    }, [employees]);

    const nonEmployeeOptions = useMemo(() => {
        if (!nonEmployees) return [{ value: 'all', label: 'Wszyscy mieszkańcy (NZ)' }];
        const options = nonEmployees.map((e: NonEmployee) => ({ value: e.id, label: e.fullName }));
        options.unshift({ value: 'all', label: 'Wszyscy mieszkańcy (NZ)' });
        return options;
    }, [nonEmployees]);


    return (
        <>
        <div className="grid gap-6">
             <Card>
                <CardHeader className='pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between min-h-[74px]'>
                    <div className="flex items-center gap-2">
                        {nzIncomeView.level === 'addresses' && (
                            <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setNzIncomeView({ level: 'localities', filter: null })}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div>
                             <CardTitle className="text-lg">Przychody (NZ) wg Lokalizacji</CardTitle>
                             {nzIncomeView.level === 'addresses' && <CardDescription>Szczegóły dla: {nzIncomeView.filter}</CardDescription>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {chartData.nzIncomeByLocation.length > 0 && chartData.nzIncomeByLocation.some(d => d.nzIncome > 0) ? (
                        <ResponsiveContainer width="100%" height={chartData.nzIncomeByLocation.length * 35 + 50}>
                            <BarChart
                                data={chartData.nzIncomeByLocation}
                                layout="vertical"
                                margin={{ top: 5, right: 30, bottom: 5, left: 10 }}
                                barCategoryGap="20%"
                            >
                                <defs>
                                    <linearGradient id="chart-nzincome-gradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                                <XAxis type="number" hide={true} />
                                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent config={chartConfig} formatter={(value) => `${value.toFixed(2)} PLN`} />} />
                                <Bar dataKey="nzIncome" radius={[0, 4, 4, 0]} fill="url(#chart-nzincome-gradient)" className={nzIncomeView.level === 'localities' ? 'cursor-pointer' : ''} onClick={handleNzIncomeClick}>
                                    <LabelList dataKey="nzIncome" position="right" offset={8} className="fill-foreground text-xs" formatter={(value: number) => value > 0 ? `${value.toFixed(2)}` : ''}/>
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ): (
                        <NoDataState message={'Brak danych o przychodach od mieszkańców (NZ)'} />
                    )}
                </CardContent>
             </Card>
             {chartData.employeesByDepartment.length > 0 && (
                <Card>
                    <CardHeader className='pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between min-h-[74px]'>
                        <CardTitle className="text-lg">Pracownicy wg zakładu</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                            <Combobox
                                options={departmentOptions}
                                value={departmentChartFilter}
                                onChange={setDepartmentChartFilter}
                                placeholder="Filtruj zakłady"
                                searchPlaceholder="Szukaj zakładu..."
                                className="w-full sm:w-[180px] h-9 text-xs"
                            />
                             <Select value={departmentChartSort} onValueChange={(v) => setDepartmentChartSort(v as 'count' | 'name')}>
                                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs"><SelectValue placeholder="Sortuj" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="count">Wg ilości</SelectItem>
                                    <SelectItem value="name">Wg nazwy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={chartData.employeesByDepartment.length * 35 + 50}>
                            <BarChart 
                                data={chartData.employeesByDepartment}
                                layout="vertical"
                                margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                barCategoryGap="20%"
                            >
                                <defs>
                                    <linearGradient id="chart-department-gradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                                <YAxis dataKey="department" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                                <XAxis type="number" allowDecimals={false} hide={true} />
                                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent config={chartConfig} />} />
                                <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-department-gradient)" className="cursor-pointer" onClick={handleDepartmentClick}>
                                    <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
            {showCoordinatorChart && chartData.employeesPerCoordinator.length > 0 && (
                <Card>
                    <CardHeader className='pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between min-h-[74px]'>
                         <CardTitle className="text-lg">Pracownicy wg koordynatora</CardTitle>
                         <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                            <Combobox
                                options={coordinatorOptions}
                                value={coordinatorChartFilter}
                                onChange={setCoordinatorChartFilter}
                                placeholder="Filtruj koordynatorów"
                                searchPlaceholder="Szukaj koordynatora..."
                                className="w-full sm:w-[180px] h-9 text-xs"
                            />
                             <Select value={coordinatorChartSort} onValueChange={(v) => setCoordinatorChartSort(v as 'count' | 'name')}>
                                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs"><SelectValue placeholder="Sortuj" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="count">Wg ilości</SelectItem>
                                    <SelectItem value="name">Wg nazwy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={chartData.employeesPerCoordinator.length * 35 + 50}>
                             <BarChart 
                                data={chartData.employeesPerCoordinator}
                                layout="vertical"
                                margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                barCategoryGap="20%"
                            >
                                <defs>
                                    <linearGradient id="chart-coordinator-gradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                                <YAxis dataKey="coordinator" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                                <XAxis type="number" allowDecimals={false} hide={true} />
                                <Tooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                                <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-coordinator-gradient)">
                                    <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
            {chartData.employeesByNationality.length > 0 && (
                <Card>
                    <CardHeader className='pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between min-h-[74px]'>
                        <CardTitle className="text-lg">Pracownicy wg narodowości</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                            <Combobox
                                options={nationalityOptions}
                                value={nationalityChartFilter}
                                onChange={setNationalityChartFilter}
                                placeholder="Filtruj narodowości"
                                searchPlaceholder="Szukaj narodowości..."
                                className="w-full sm:w-[180px] h-9 text-xs"
                            />
                             <Select value={nationalityChartSort} onValueChange={(v) => setNationalityChartSort(v as 'count' | 'name')}>
                                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs"><SelectValue placeholder="Sortuj" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="count">Wg ilości</SelectItem>
                                    <SelectItem value="name">Wg nazwy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={chartData.employeesByNationality.length * 35 + 50}>
                            <BarChart 
                                data={chartData.employeesByNationality} 
                                layout="vertical"
                                margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                                barCategoryGap="20%"
                            >
                                <defs>
                                    <linearGradient id="chart-nationality-gradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50"/>
                                <YAxis dataKey="nationality" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                                <XAxis type="number" allowDecimals={false} hide={true} />
                                <Tooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                                <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-nationality-gradient)">
                                    <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
           
            <Card>
                <CardHeader className='pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between min-h-[74px]'>
                    <div>
                        <CardTitle className="text-lg">Statystyka wyjazdów</CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                        <Select value={String(departureYear)} onValueChange={(v) => setDepartureYear(Number(v))}>
                            <SelectTrigger className="w-full sm:w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={String(departureMonth)} onValueChange={(v) => setDepartureMonth(v === 'all' ? 'all' : Number(v))}>
                            <SelectTrigger className="w-full sm:w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszystkie miesiące</SelectItem>
                                {months.map(m => <SelectItem key={m} value={String(m)}>{format(new Date(departureYear, m-1), 'LLLL', {locale: pl})}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {chartData.departuresByMonth.length > 0 && chartData.departuresByMonth.some(d => d.departures > 0) ? (
                         <ChartContainer config={chartConfig} className="w-full aspect-video">
                            <ResponsiveContainer width="100%" height={350}>
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
                                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} hide={true} />
                                    <Tooltip cursor={false} content={<ChartTooltipContent config={chartConfig} />} />
                                    <Bar dataKey="departures" radius={[4, 4, 0, 0]} fill="url(#chart-departures-gradient)">
                                       <LabelList dataKey="departures" position="top" offset={8} className="fill-foreground text-xs" formatter={(value: number) => value > 0 ? `${value}` : ''}/>
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
                    <div>
                        <CardTitle className="text-lg">Potrącenia</CardTitle>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 sm:pt-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Rok</Label>
                            <Select value={String(deductionYear)} onValueChange={(v) => setDeductionYear(Number(v))}>
                                <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Miesiąc</Label>
                            <Select value={String(deductionMonth)} onValueChange={(v) => setDeductionMonth(v === 'all' ? 'all' : Number(v))}>
                                <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Wszystkie miesiące</SelectItem>
                                    {months.map(m => <SelectItem key={m} value={String(m)}>{format(new Date(deductionYear, m-1), 'LLLL', {locale: pl})}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1.5">
                            <Label className="text-xs">Miejscowość</Label>
                            <Combobox options={localitiesOptions} value={deductionLocality} onChange={setDeductionLocality} placeholder="Wszystkie" searchPlaceholder="Szukaj..." className="w-full h-8 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Adres</Label>
                            <Combobox options={addressesOptions} value={deductionAddress} onChange={setDeductionAddress} placeholder="Wszystkie" searchPlaceholder="Szukaj..." className="w-full h-8 text-xs" />
                        </div>
                         <div className="space-y-1.5">
                            <Label className="text-xs">Pracownik</Label>
                            <Combobox options={employeeOptions} value={deductionEmployee} onChange={setDeductionEmployee} placeholder="Wszyscy" searchPlaceholder="Szukaj..." className="w-full h-8 text-xs" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {chartData.deductionsByDate.length > 0 && chartData.deductionsByDate.some(d => d.deductions > 0) ? (
                         <ChartContainer config={chartConfig} className="w-full aspect-video">
                            <ResponsiveContainer width="100%" height={350}>
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
                                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} hide={true} />
                                    <Tooltip cursor={false} content={<ChartTooltipContent config={chartConfig} formatter={(value) => `${value} PLN`}/>} />
                                    <Bar dataKey="deductions" radius={[4, 4, 0, 0]} fill="url(#chart-deductions-gradient)">
                                       <LabelList dataKey="deductions" position="top" offset={8} className="fill-foreground text-xs" formatter={(value: number) => value > 0 ? `${value.toFixed(2)}` : ''}/>
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
        <EmployeeListDialog 
            isOpen={isEmployeeListDialogOpen}
            onOpenChange={setIsEmployeeListDialogOpen}
            departmentName={selectedDepartment.name}
            employees={selectedDepartment.employees}
        />
        </>
    );
}
