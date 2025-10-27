
"use client";

import React, { useEffect, useState } from 'react';
import { useMainLayout } from '@/components/main-layout';
import type { ImportStatus, SessionData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';
import { Progress } from './ui/progress';

const StatusBadge = ({ status }: { status: ImportStatus['status'] }) => {
    return (
        <Badge
            variant={status === 'completed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'}
            className={cn(status === 'completed' && 'bg-green-600')}
        >
            {status === 'processing' && 'Przetwarzanie'}
            {status === 'completed' && 'Zakończono'}
            {status === 'failed' && 'Błąd'}
        </Badge>
    );
};

export default function ImportStatusView({ currentUser }: { currentUser: SessionData }) {
    const { allImportStatuses, refreshData } = useMainLayout();
    const [isLoading, setIsLoading] = useState(false);

    const handleRefresh = async () => {
        setIsLoading(true);
        await refreshData(true);
        setIsLoading(false);
    }
    
    useEffect(() => {
        const interval = setInterval(() => {
             const isProcessing = allImportStatuses?.some(s => s.status === 'processing');
             if(isProcessing) {
                refreshData(false);
             }
        }, 5000); // Poll every 5 seconds if there are processing jobs

        return () => clearInterval(interval);
    }, [allImportStatuses, refreshData]);

    if (!allImportStatuses) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Status importu plików</CardTitle>
                    <CardDescription>Historia i status operacji importu danych z plików Excel.</CardDescription>
                </div>
                 <Button onClick={handleRefresh} variant="outline" size="icon" disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {allImportStatuses.length > 0 ? (
                        allImportStatuses.map(job => (
                            <Card key={job.jobId} className="p-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <p className="font-semibold">{job.fileName}</p>
                                            <StatusBadge status={job.status} />
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {job.actorName} - {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true, locale: pl })}
                                        </p>
                                    </div>
                                    <div className="text-sm text-muted-foreground w-full sm:w-auto sm:text-right">
                                        {job.status === 'processing' && job.totalRows > 0 && (
                                           <div className="w-full sm:w-48">
                                                <Progress value={(job.processedRows / job.totalRows) * 100} className="h-2" />
                                                <p className="text-xs text-center mt-1">{job.processedRows} / {job.totalRows}</p>
                                           </div>
                                        )}
                                    </div>
                                </div>
                                {(job.status === 'failed' || job.status === 'completed') && (
                                     <p className={cn(
                                        "text-sm mt-2 p-2 rounded-md", 
                                        job.status === 'failed' ? "bg-destructive/10 text-destructive" : "bg-green-600/10 text-green-700"
                                     )}>
                                        {job.message}
                                     </p>
                                )}
                            </Card>
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground py-10">
                            <p>Brak historii importów.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
