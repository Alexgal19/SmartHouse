
"use client";

import { useMemo } from 'react';
import { useMainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Combobox } from '@/components/ui/combobox';
import type { Coordinator } from '@/types';
import { useLanguage } from '@/lib/i18n';

export function CoordinatorFilter() {
    const { t } = useLanguage();
    const { settings, selectedCoordinatorId, setSelectedCoordinatorId } = useMainLayout();

    const coordinatorOptions = useMemo(() => {
        if (!settings) return [];
        const options = settings.coordinators
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c: Coordinator) => ({
                value: c.uid,
                label: c.name,
            }));

        options.unshift({ value: 'all', label: t('dashboard.allCoordinatorsOption') });
        return options;
    }, [settings, t]);

    return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4">
            <CardHeader>
                <CardTitle>{t('dashboard.mainFilters')}</CardTitle>
                <CardDescription>{t('dashboard.filterDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="coordinator-filter">{t('form.coordinator')}</Label>
                        <Combobox
                            options={coordinatorOptions}
                            value={selectedCoordinatorId}
                            onChange={setSelectedCoordinatorId}
                            placeholder={t('form.selectCoordinator')}
                            searchPlaceholder={t('settings.searchCoordinator')}
                            notFoundMessage={t('dashboard.coordinatorNotFound')}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
