"use client";

import { useMainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { redirect } from 'next/navigation';
import OdbiorView from '@/components/views/odbior-view';

export default function OdbiorViewPage() {
    const { currentUser, settings } = useMainLayout();

    if (!currentUser || !settings) {
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
            </div>
        );
    }

    if (!(currentUser?.isDriver || currentUser?.isAdmin)) {
        redirect('/dashboard');
    }
    return <OdbiorView currentUser={currentUser} />;
}
