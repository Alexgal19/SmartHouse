"use client";

import type { Employee, Settings } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList, Cell } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { useMemo, useState } from "react";
import { Building, UserMinus, Users } from "lucide-react";
import { isWithinInterval, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "./ui/scroll-area";

interface DashboardViewProps {
  employees: Employee[];
  settings: Settings;
  onEditEmployee: (employee: Employee) => void;
}

export default function DashboardView({ employees, settings, onEditEmployee }: DashboardViewProps) {
  const [isHousingDialogOpen, setIsHousingDialogOpen] = useState(false);
  const [isCheckoutsDialogOpen, setIsCheckoutsDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const apartmentsInUse = useMemo(() => [...new Set(activeEmployees.map(e => e.address))].length, [activeEmployees]);
  
  const upcomingCheckoutsList = useMemo(() => {
    const today = new Date();
    const next30Days = { start: today, end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) };
    return activeEmployees
      .filter(e => e.contractEndDate && isWithinInterval(e.contractEndDate, next30Days))
      .sort((a, b) => a.contractEndDate!.getTime() - b.contractEndDate!.getTime());
  }, [activeEmployees]);
  
  const upcomingCheckoutsCount = upcomingCheckoutsList.length;

  const handleEmployeeClick = (employee: Employee) => {
    setIsCheckoutsDialogOpen(false);
    onEditEmployee(employee);
  };

  const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

  const kpiData = [
    { title: "Wszyscy pracownicy", value: activeEmployees.length, icon: Users, color: "text-blue-400" },
    { title: "Używane mieszkania", value: apartmentsInUse, icon: Building, color: "text-orange-400" },
  ];

  const housingOverview = useMemo(() => {
    return settings.addresses.map(address => {
      const occupied = activeEmployees.filter(e => e.address === address.name).length;
      const capacity = address.capacity;
      const available = capacity - occupied;
      const occupancy = capacity > 0 ? (occupied / capacity) * 100 : 0;
      return { ...address, occupied, available, occupancy };
    }).sort((a, b) => b.occupancy - a.occupancy);
  }, [settings.addresses, activeEmployees]);

  const aggregateData = (key: 'coordinatorId' | 'nationality' | 'zaklad') => {
    const counts = activeEmployees.reduce((acc, employee) => {
      const value = employee[key];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (key === 'coordinatorId') {
        return Object.entries(counts).map(([id, count]) => ({
            name: settings.coordinators.find(c => c.uid === id)?.name || id,
            value: count
        }));
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const employeesByCoordinator = useMemo(() => aggregateData('coordinatorId'), [activeEmployees, settings.coordinators]);
  const employeesByNationality = useMemo(() => aggregateData('nationality'), [activeEmployees]);
  const employeesByDepartment = useMemo(() => aggregateData('zaklad'), [activeEmployees]);

 const chartConfig = {
    value: { label: "Pracownicy" },
  };
  
  const chartColors = [
    { from: 'hsl(var(--chart-1))', to: 'hsl(var(--chart-2))', id: 'grad1' },
    { from: 'hsl(var(--chart-2))', to: 'hsl(var(--chart-3))', id: 'grad2' },
    { from: 'hsl(var(--chart-3))', to: 'hsl(var(--chart-4))', id: 'grad4' },
    { from: 'hsl(var(--chart-4))', to: 'hsl(var(--chart-5))', id: 'grad5' },
    { from: 'hsl(var(--chart-5))', to: 'hsl(var(--chart-1))', id: 'grad5' },
  ];

  const ChartComponent = ({ data, title }: { data: {name: string, value: number}[], title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-0 sm:pl-2">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 20, right: 20, left: isMobile ? -20 : -10, bottom: isMobile ? 15 : 5 }} barSize={isMobile ? 25 : 50}>
               <defs>
                {chartColors.map((color, index) => (
                  <linearGradient id={color.id} x1="0" y1="0" x2="0" y2="1" key={index}>
                    <stop offset="5%" stopColor={color.from} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={color.to} stopOpacity={0.8}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis 
                dataKey="name" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                interval={0}
                angle={isMobile ? -35 : 0}
                dy={isMobile ? 10 : 0}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--accent) / 0.1)' }} 
                content={({ active, payload, label }) => active && payload && payload.length && (
                    <div className="bg-background/95 p-3 rounded-lg border shadow-lg">
                        <p className="font-bold text-foreground">{label}</p>
                        <p className="text-sm text-primary">{`${payload[0].value} pracowników`}</p>
                    </div>
                )}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} >
                <LabelList dataKey="value" position="top" offset={10} className="fill-foreground font-semibold" />
                 {data.map((entry, index) => {
                    const color = chartColors[index % chartColors.length];
                    return <Cell key={`cell-${index}`} fill={`url(#${color.id})`} />
                 })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpiData.map(kpi => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 text-muted-foreground ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}

        <Dialog open={isCheckoutsDialogOpen} onOpenChange={setIsCheckoutsDialogOpen}>
            <DialogTrigger asChild>
                <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nadchodzące wykwaterowania (30 dni)</CardTitle>
                        <UserMinus className="h-4 w-4 text-muted-foreground text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{upcomingCheckoutsCount}</div>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Pracownicy z nadchodzącym terminem wykwaterowania</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-full">
                  <div className="pr-4">
                    {upcomingCheckoutsList.length > 0 ? (
                        upcomingCheckoutsList.map(employee => (
                            <Card key={employee.id} onClick={() => handleEmployeeClick(employee)} className="mb-3 cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="text-base">{employee.fullName}</CardTitle>
                                    <CardDescription>{getCoordinatorName(employee.coordinatorId)}</CardDescription>
                                </CardHeader>
                                <CardContent className="text-sm space-y-1">
                                    <p><span className="font-semibold">Adres:</span> {employee.address}</p>
                                    <p><span className="font-semibold">Data wyjazdu:</span> {employee.contractEndDate ? format(employee.contractEndDate, 'dd-MM-yyyy') : 'N/A'}</p>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-8">Brak pracowników z nadchodzącym terminem wyjazdu.</p>
                    )}
                  </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      </div>

       <Dialog open={isHousingDialogOpen} onOpenChange={setIsHousingDialogOpen}>
          <DialogTrigger asChild>
             <Card 
                className="cursor-pointer hover:border-primary transition-colors"
             >
                <CardHeader>
                    <CardTitle>Przegląd zakwaterowania</CardTitle>
                    <CardDescription>Kliknij, aby zobaczyć obłożenie i dostępność mieszkań.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                          {settings.addresses.length} dostępnych adresów
                      </div>
                       <Button variant="outline" size="sm">Zobacz szczegóły</Button>
                   </div>
                </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Obłożenie i dostępność mieszkań</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-full">
                <div className="space-y-4 pr-4">
                  {housingOverview.map(house => (
                      <Card key={house.id}>
                        <CardHeader className="pb-2">
                           <CardTitle className="text-base truncate">{house.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <div className="flex items-center gap-3">
                              <Progress value={house.occupancy} className="w-full h-2" />
                              <span className="text-sm font-medium text-muted-foreground shrink-0">{Math.round(house.occupancy)}%</span>
                           </div>
                           <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                                <span>Zajęte: <span className="font-bold text-foreground">{house.occupied}</span></span>
                                <span>Pojemność: <span className="font-bold text-foreground">{house.capacity}</span></span>
                                <span>Wolne: <span className="font-bold text-foreground">{house.available}</span></span>
                           </div>
                        </CardContent>
                      </Card>
                  ))}
                </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>
      
      {!isMobile && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <ChartComponent data={employeesByCoordinator} title="Pracownicy wg koordynatora" />
          <ChartComponent data={employeesByNationality} title="Pracownicy wg narodowości" />
          <div className="lg:col-span-2">
              <ChartComponent data={employeesByDepartment} title="Pracownicy wg zakładu" />
          </div>
        </div>
      )}
    </div>
  );
}
