
"use client";

import React, { useState, useMemo } from 'react';
import { useMainLayout } from '@/components/main-layout';
import type { Inspection, SessionData, InspectionCategoryItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import InspectionForm from './inspection-form';

const renderValue = (item: InspectionCategoryItem) => {
    if (item.type === 'yes_no') {
        return item.value ? 'Tak' : 'Nie';
    }
    if (item.type === 'checkbox_group' && Array.isArray(item.value)) {
        return item.value.join(', ');
    }
    return String(item.value);
};


const InspectionDetailDialog = ({ inspection, isOpen, onOpenChange }: { inspection: Inspection | null; isOpen: boolean; onOpenChange: (open: boolean) => void; }) => {
    if (!inspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl flex flex-col h-screen sm:h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Szczegóły inspekcji</DialogTitle>
                    <DialogDescription>{inspection.addressName} - {format(new Date(inspection.date), 'PPP')}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 -mr-6 pr-6">
                    <div className="space-y-4 py-4">
                        {inspection.categories.map((category, i) => (
                            <Card key={i}>
                                <CardHeader><CardTitle className="text-base">{category.name}</CardTitle></CardHeader>
                                <CardContent>
                                    <ul className="space-y-2 text-sm">
                                        {category.items.map((item, j) => (
                                            <li key={j} className="flex justify-between">
                                                <span>{item.label}:</span>
                                                <span className="font-semibold text-right">{renderValue(item)}</span>
                                            </li>
                                        ))}
                                        {category.uwagi && <li className="pt-2"><strong className="text-muted-foreground">Uwagi:</strong> {category.uwagi}</li>}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default function InspectionsView({ currentUser }: { currentUser: SessionData }) {
    const { allInspections, settings, handleAddInspection } = useMainLayout();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

    const inspections = useMemo(() => {
        if (!allInspections) return [];
        return allInspections.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allInspections]);

    if (!allInspections || !settings) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Inspekcje</CardTitle>
                        <CardDescription>Przeglądaj i dodawaj nowe inspekcje.</CardDescription>
                    </div>
                    <Button onClick={() => setIsFormOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Dodaj inspekcję
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Adres</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Koordynator</TableHead>
                                <TableHead>Standard</TableHead>
                                <TableHead><span className="sr-only">Akcje</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {inspections.length > 0 ? (
                                inspections.map(inspection => (
                                    <TableRow key={inspection.id} onClick={() => setSelectedInspection(inspection)} className="cursor-pointer">
                                        <TableCell className="font-medium">{inspection.addressName}</TableCell>
                                        <TableCell>{format(new Date(inspection.date), 'dd-MM-yyyy')}</TableCell>
                                        <TableCell>{inspection.coordinatorName}</TableCell>
                                        <TableCell>{inspection.standard || 'N/A'}</TableCell>
                                        <TableCell>
                                             <Button variant="ghost" size="icon" onClick={() => setSelectedInspection(inspection)}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Brak inspekcji.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <InspectionForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                settings={settings}
                currentUser={currentUser}
                onSave={handleAddInspection}
            />

            <InspectionDetailDialog
                inspection={selectedInspection}
                isOpen={!!selectedInspection}
                onOpenChange={(isOpen) => !isOpen && setSelectedInspection(null)}
            />
        </>
    );
}

  