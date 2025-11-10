
"use client";

import DashboardView from '@/components/dashboard-view';
import { useMainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SessionData, View } from '@/types';
import { useSearchParams } from 'next/navigation';
import EntityView from '@/components/entity-view';
import HousingView from '@/components/housing-view';
import dynamic from 'next/dynamic';


const DynamicSettingsView = dynamic(() => import('@/components/settings-view'), {
    loading: () => (
        <div className="space-y-6">
            <Card>
                <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-48 w-full" /></CardContent>
            </Card>
            <Card>
                <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-32 w-full" /></CardContent>
            </Card>
        </div>
    ),
    ssr: false,
});


function CurrentView({ activeView, currentUser }: { activeView: View; currentUser: SessionData }) {
  switch (activeView) {
    case 'dashboard':
      return <DashboardView currentUser={currentUser} />;
    case 'employees':
      return <EntityView currentUser={currentUser} />;
    case 'housing':
      return <HousingView currentUser={currentUser} />;
    case 'settings':
      return <DynamicSettingsView currentUser={currentUser} />;
    default:
      return (
        <DashboardView currentUser={currentUser} />
      )
  }
}

export default function DashboardPage() {
    const searchParams = useSearchParams();
    const { currentUser, allEmployees, settings } = useMainLayout();
    const activeView = (searchParams.get('view') as View) || 'dashboard';

    if (!currentUser || !allEmployees || !settings) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/4" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                             <Skeleton className="h-24 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return <CurrentView activeView={activeView} currentUser={currentUser} />;
}
