
"use client";

import { useMemo } from 'react';
import { useMainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Combobox } from '@/components/ui/combobox';
import type { Coordinator } from '@/types';

export function CoordinatorFilter() {
    const { settings, selectedCoordinatorId, setSelectedCoordinatorId } = useMainLayout();

    const coordinatorOptions = useMemo(() => {
        if (!settings) return [];
        const options = settings.coordinators
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c: Coordinator) => ({
                value: c.uid,
                label: c.name,
            }));
        
        options.unshift({ value: 'all', label: 'Wszyscy Koordynatorzy' });
        return options;
    }, [settings]);

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
                        <Combobox
                            options={coordinatorOptions}
                            value={selectedCoordinatorId}
                            onChange={setSelectedCoordinatorId}
                            placeholder="Wybierz koordynatora"
                            searchPlaceholder="Szukaj koordynatora..."
                            notFoundMessage="Nie znaleziono koordynatora."
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

