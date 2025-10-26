
"use client";

import { useMemo } from 'react';
import type { Employee } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useMainLayout } from '@/components/main-layout';
import { differenceInDays, parseISO } from 'date-fns';

export function UpcomingCheckoutsDialog({
    isOpen,
    onOpenChange,
    employees
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    employees: Employee[];
}) {
    const { handleEditEmployeeClick } = useMainLayout();

    const upcomingCheckoutsEmployees = useMemo(() => {
        return employees
            .filter(e => e.status === 'active' && e.checkOutDate)
            .map(e => ({
                ...e,
                checkOutDateObj: parseISO(e.checkOutDate!),
            }))
            .filter(e => {
                const diff = differenceInDays(e.checkOutDateObj, new Date());
                return diff >= 0 && diff <= 30;
            })
            .sort((a, b) => a.checkOutDateObj.getTime() - b.checkOutDateObj.getTime());
    }, [employees]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col h-screen sm:h-[90vh] sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Nadchodzące wykwaterowania</DialogTitle>
                    <DialogDescription>Pracownicy, którzy wykwaterują się w ciągu najbliższych 30 dni.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 -mr-6 pr-6">
                    <div className="space-y-2 p-1">
                        {upcomingCheckoutsEmployees.length > 0 ? (
                            upcomingCheckoutsEmployees.map(employee => (
                            <Card 
                                key={employee.id} 
                                className="p-4 cursor-pointer hover:bg-muted/50 shadow-sm"
                                onClick={() => {
                                    handleEditEmployeeClick(employee);
                                    onOpenChange(false);
                                }}
                            >
                                <div className="flex justify-between items-start">
                                    <span className="font-semibold">{employee.fullName}</span>
                                    <span className="text-sm text-primary font-bold whitespace-nowrap">{employee.checkOutDate}</span>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    <p>{employee.zaklad}</p>
                                    <p>{employee.address || ''} {employee.roomNumber ? `, pokój ${employee.roomNumber}` : ''}</p>
                                </div>
                            </Card>
                            ))
                        ) : (
                            <p className="text-center text-sm text-muted-foreground py-4">Brak nadchodzących wykwaterowań.</p>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
