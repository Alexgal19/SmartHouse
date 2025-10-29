
"use client";

import { useMemo, useState } from 'react';
import type { SessionData } from "@/types";
import { useMainLayout } from '@/components/main-layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardKPIs } from './dashboard/kpi-cards';
import { CoordinatorFilter } from './dashboard/coordinator-filter';
import { DashboardCharts } from './dashboard/charts';
import { HousingView } from './dashboard/housing-view';
import { UpcomingCheckoutsDialog } from './dashboard/upcoming-checkouts-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent } from './ui/chart';

export default function DashboardView({ currentUser }: { currentUser: SessionData}) {
  const { 
    allEmployees, 
    allNonEmployees,
    settings,
    selectedCoordinatorId,
  } = useMainLayout();

  const [isUpcomingCheckoutsModalOpen, setIsUpcomingCheckoutsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  const { isMobile } = useIsMobile();

  const departmentChartData = useMemo(() => {
    if (!allEmployees) return [];
    const activeEmployees = allEmployees.filter(e => e.status === 'active');
    const employeesByDepartment = activeEmployees.reduce((acc, employee) => {
        const department = employee.zaklad || 'Brak';
        if (department) {
            if(!acc[department]) {
                acc[department] = { department, employees: 0 };
            }
            acc[department].employees++;
        }
        return acc;
    }, {} as Record<string, { department: string, employees: number }>);
    return Object.values(employeesByDepartment).sort((a,b) => b.employees - a.employees);
  }, [allEmployees]);
  
  if (!allEmployees || !allNonEmployees || !settings) {
      return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        </div>
      );
  }
  
  const statsContent = (
      <div className="space-y-6">
        <DashboardKPIs 
            employees={allEmployees}
            nonEmployees={allNonEmployees}
            onUpcomingCheckoutsClick={() => setIsUpcomingCheckoutsModalOpen(true)}
        />
        <DashboardCharts 
            employees={allEmployees}
            settings={settings}
            isMobile={isMobile}
        />
      </div>
  );

  const housingContent = (
    <div className="space-y-6">
        <HousingView 
            employees={allEmployees}
            nonEmployees={allNonEmployees}
            settings={settings}
            currentUser={currentUser}
            selectedCoordinatorId={selectedCoordinatorId}
        />
        {departmentChartData.length > 0 && (
             <Card>
                <CardHeader className='pb-2'>
                    <CardTitle className="text-lg">Pracownicy według zakładu</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="h-64">
                        <BarChart 
                            data={departmentChartData}
                            layout="vertical"
                            margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                            barSize={15}
                        >
                            <defs>
                                <linearGradient id="chart-department-gradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
                            <YAxis dataKey="department" type="category" tickLine={false} axisLine={false} tickMargin={8} width={150} className="text-xs" interval={0} />
                            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="employees" radius={[0, 4, 4, 0]} fill="url(#chart-department-gradient)">
                                <LabelList dataKey="employees" position="right" offset={8} className="fill-foreground text-xs" />
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        )}
    </div>
  );
  
  return (
    <>
      <div className="space-y-6">
          {currentUser.isAdmin && <CoordinatorFilter />}
          {isMobile ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4 grid w-full grid-cols-2">
                      <TabsTrigger value="stats">Podsumowanie</TabsTrigger>
                      <TabsTrigger value="housing">Zakwaterowanie</TabsTrigger>
                  </TabsList>
                  <TabsContent value="stats">{statsContent}</TabsContent>
                  <TabsContent value="housing">{housingContent}</TabsContent>
              </Tabs>
          ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {statsContent}
                  {housingContent}
              </div>
          )}
      </div>

      <UpcomingCheckoutsDialog 
        isOpen={isUpcomingCheckoutsModalOpen}
        onOpenChange={setIsUpcomingCheckoutsModalOpen}
        employees={allEmployees}
      />
    </>
  );
}

