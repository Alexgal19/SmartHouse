
"use client";

import { useState } from 'react';
import type { SessionData } from "@/types";
import { useMainLayout } from '@/components/main-layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardKPIs } from './dashboard/kpi-cards';
import { CoordinatorFilter } from './dashboard/coordinator-filter';
import { DashboardCharts } from './dashboard/charts';
import { UpcomingCheckoutsDialog } from './dashboard/upcoming-checkouts-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from './ui/card';
import { differenceInDays, parseISO } from 'date-fns';

export default function DashboardView({ currentUser }: { currentUser: SessionData}) {
  const { 
    allEmployees, 
    allNonEmployees,
    settings,
    hasNewCheckouts,
    setHasNewCheckouts
  } = useMainLayout();

  const [isUpcomingCheckoutsModalOpen, setIsUpcomingCheckoutsModalOpen] = useState(false);

  const { isMobile } = useIsMobile();
  
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
  
  const handleUpcomingCheckoutsClick = () => {
    setIsUpcomingCheckoutsModalOpen(true);
    setHasNewCheckouts(false);
    
    if (allEmployees && allNonEmployees) {
        const upcomingIds = [...allEmployees, ...allNonEmployees]
            .filter(o => {
                if (!o.checkOutDate) return false;
                const today = new Date();
                const date = parseISO(o.checkOutDate);
                const diff = differenceInDays(date, today);
                return diff >= 0 && diff <= 30;
            })
            .map(o => o.id);
        localStorage.setItem('upcomingCheckouts', JSON.stringify(upcomingIds));
    }
  };
  
  return (
    <>
      <div className="space-y-6">
          {currentUser.isAdmin && <CoordinatorFilter />}
          <DashboardKPIs 
              employees={allEmployees}
              nonEmployees={allNonEmployees}
              onUpcomingCheckoutsClick={handleUpcomingCheckoutsClick}
              hasNewCheckouts={currentUser.isAdmin && hasNewCheckouts}
          />
          <DashboardCharts 
              employees={allEmployees}
              settings={settings}
              isMobile={isMobile}
          />
      </div>

      <UpcomingCheckoutsDialog 
        isOpen={isUpcomingCheckoutsModalOpen}
        onOpenChange={setIsUpcomingCheckoutsModalOpen}
        employees={allEmployees}
        nonEmployees={allNonEmployees}
      />
    </>
  );
}
