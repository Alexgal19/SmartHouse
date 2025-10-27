"use client";

import { useMemo, useState } from 'react';
import type { SessionData } from "@/types";
import { useMainLayout } from '@/components/main-layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardKPIs } from './dashboard/kpi-cards';
import { CoordinatorFilter } from './dashboard/coordinator-filter';
import { DashboardCharts }from './dashboard/charts';
import { HousingView } from './dashboard/housing-view';
import { UpcomingCheckoutsDialog } from './dashboard/upcoming-checkouts-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from './ui/card';

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
  
  const employeesForCoordinator = useMemo(() => {
    if (!allEmployees) return [];
    if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
      return allEmployees;
    }
    return allEmployees.filter(e => e.coordinatorId === selectedCoordinatorId);
  }, [allEmployees, currentUser.isAdmin, selectedCoordinatorId]);

  const nonEmployeesForCoordinator = useMemo(() => {
    if (!allNonEmployees || !settings) return [];
    if (currentUser.isAdmin && selectedCoordinatorId === 'all') {
      return allNonEmployees;
    }
     const coordinatorAddresses = settings.addresses
      .filter(a => a.coordinatorId === selectedCoordinatorId)
      .map(a => a.name);

    return allNonEmployees.filter(ne => coordinatorAddresses.includes(ne.address));
  }, [allNonEmployees, settings, currentUser.isAdmin, selectedCoordinatorId]);

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
            employees={employeesForCoordinator}
            nonEmployees={nonEmployeesForCoordinator}
            settings={settings}
            onUpcomingCheckoutsClick={() => setIsUpcomingCheckoutsModalOpen(true)}
        />
        <DashboardCharts 
            employees={employeesForCoordinator}
            dismissedEmployees={allEmployees.filter(e => e.status === 'dismissed')}
            settings={settings}
            inspections={[]}
            isMobile={isMobile}
        />
      </div>
  );

  const housingContent = (
    <HousingView 
        employees={employeesForCoordinator}
        nonEmployees={nonEmployeesForCoordinator}
        settings={settings}
        currentUser={currentUser}
        selectedCoordinatorId={selectedCoordinatorId}
    />
  );
  
  return (
    <>
      <div className="grid gap-6 p-4 sm:p-6">
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
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4 grid w-full grid-cols-2">
                      <TabsTrigger value="stats">Podsumowanie</TabsTrigger>
                      <TabsTrigger value="housing">Zakwaterowanie</TabsTrigger>
                  </TabsList>
                  <TabsContent value="stats">{statsContent}</TabsContent>
                  <TabsContent value="housing">{housingContent}</TabsContent>
              </Tabs>
          )}
      </div>

      <UpcomingCheckoutsDialog 
        isOpen={isUpcomingCheckoutsModalOpen}
        onOpenChange={setIsUpcomingCheckoutsModalOpen}
        employees={employeesForCoordinator}
      />
    </>
  );
}
