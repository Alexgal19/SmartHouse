
"use client";

import { useMainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CoordinatorFilter() {
    const { settings, selectedCoordinatorId, setSelectedCoordinatorId } = useMainLayout();

    return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4">
            <CardHeader>
                <CardTitle>Filtry Główne</CardTitle>
                <CardDescription>Wybierz koordynatora, aby filtrować dane w całej aplikacji.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="coordinator-filter">Koordynator</Label>
                        <Select value={selectedCoordinatorId} onValueChange={setSelectedCoordinatorId}>
                            <SelectTrigger id="coordinator-filter">
                                <SelectValue placeholder='Wszyscy Koordynatorzy' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Wszyscy Koordynatorzy</SelectItem>
                                {settings?.coordinators.map(c => (
                                    <SelectItem key={c.uid} value={c.uid}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
