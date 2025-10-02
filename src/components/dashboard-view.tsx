"use client";

import type { Employee, HousingAddress, Settings } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from "react";
import { Building, UserCheck, UserMinus, Users } from "lucide-react";
import { subDays, isWithinInterval } from "date-fns";

interface DashboardViewProps {
  employees: Employee[];
  settings: Settings;
}

export default function DashboardView({ employees, settings }: DashboardViewProps) {
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const apartmentsInUse = useMemo(() => [...new Set(activeEmployees.map(e => e.address))].length, [activeEmployees]);
  
  const upcomingCheckouts = useMemo(() => {
    const today = new Date();
    const next30Days = { start: today, end: subDays(today, -30) };
    return activeEmployees.filter(e => e.contractEndDate && isWithinInterval(e.contractEndDate, next30Days)).length;
  }, [activeEmployees]);

  const kpiData = [
    { title: "Wszyscy pracownicy", value: activeEmployees.length, icon: Users, color: "text-blue-400" },
    { title: "Używane mieszkania", value: apartmentsInUse, icon: Building, color: "text-orange-400" },
    { title: "Nadchodzące wykwaterowania (30 dni)", value: upcomingCheckouts, icon: UserMinus, color: "text-red-400" },
  ];

  const housingOverview = useMemo(() => {
    return settings.addresses.map(address => {
      const occupied = activeEmployees.filter(e => e.address === address.name).length;
      const capacity = address.capacity;
      const available = capacity - occupied;
      const occupancy = capacity > 0 ? (occupied / capacity) * 100 : 0;
      return { ...address, occupied, available, occupancy };
    });
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
    value: { label: "Pracownicy", color: "hsl(var(--primary))" },
  };

  const ChartComponent = ({ data, title }: { data: {name: string, value: number}[], title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Przegląd zakwaterowania</CardTitle>
          <CardDescription>Obłożenie i dostępność mieszkań.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adres</TableHead>
                  <TableHead className="text-center">Pojemność</TableHead>
                  <TableHead className="text-center">Zajęte</TableHead>
                  <TableHead className="text-center">Wolne</TableHead>
                  <TableHead className="w-[150px]">Obłożenie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {housingOverview.map(house => (
                  <TableRow key={house.id}>
                    <TableCell className="font-medium whitespace-nowrap">{house.name}</TableCell>
                    <TableCell className="text-center">{house.capacity}</TableCell>
                    <TableCell className="text-center">{house.occupied}</TableCell>
                    <TableCell className="text-center">{house.available}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={house.occupancy} className="w-full h-2" />
                        <span className="text-sm font-medium text-muted-foreground">{Math.round(house.occupancy)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <ChartComponent data={employeesByCoordinator} title="Pracownicy wg koordynatora" />
        <ChartComponent data={employeesByNationality} title="Pracownicy wg narodowości" />
        <div className="lg:col-span-2">
            <ChartComponent data={employeesByDepartment} title="Pracownicy wg zakładu" />
        </div>
      </div>
    </div>
  );
}
