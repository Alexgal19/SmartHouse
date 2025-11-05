
"use client";

import { useMemo } from 'react';
import type { Employee, NonEmployee } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useMainLayout } from '@/components/main-layout';
import { differenceInDays, parseISO } from 'date-fns';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '../ui/button';
import { Copy } from 'lucide-react';
import {format} from 'date-fns'

type Occupant = Employee | NonEmployee;

const isEmployee = (occupant: Occupant): occupant is Employee => 'coordinatorId' in occupant;

const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        // Use regex to check for YYYY-MM-DD format and add time to avoid timezone issues
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return format(new Date(dateString + 'T00:00:00'), 'dd-MM-yyyy');
        }
        return format(new Date(dateString), 'dd-MM-yyyy');
    } catch {
        return 'Invalid Date';
    }
}

export function UpcomingCheckoutsDialog({
    isOpen,
    onOpenChange,
    employees,
    nonEmployees
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    employees: Employee[];
    nonEmployees: NonEmployee[];
}) {
    const { handleEditEmployeeClick, handleEditNonEmployeeClick } = useMainLayout();
    const { copyToClipboard } = useCopyToClipboard();

    const upcomingCheckouts = useMemo(() => {
        const allOccupants: Occupant[] = [
            ...employees.filter(e => e.status === 'active'), 
            ...nonEmployees
        ];

        return allOccupants
            .filter(o => o.checkOutDate)
            .map(o => ({
                ...o,
                checkOutDateObj: parseISO(o.checkOutDate!),
            }))
            .filter(o => {
                const diff = differenceInDays(o.checkOutDateObj, new Date());
                return diff >= 0 && diff <= 30;
            })
            .sort((a, b) => a.checkOutDateObj.getTime() - b.checkOutDateObj.getTime());
    }, [employees, nonEmployees]);
    
    const handleCopy = (occupant: Occupant) => {
        const textToCopy = `${occupant.fullName}, wykwaterowanie: ${formatDate(occupant.checkOutDate)}`;
        copyToClipboard(textToCopy, `Skopiowano dane: ${occupant.fullName}`);
    }

    const handleOccupantClick = (occupant: Occupant) => {
        if(isEmployee(occupant)) {
            handleEditEmployeeClick(occupant);
        } else {
            handleEditNonEmployeeClick(occupant);
        }
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col h-screen sm:h-[90vh] sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Nadchodzące wykwaterowania</DialogTitle>
                    <DialogDescription>Osoby, które wykwaterują się w ciągu najbliższych 30 dni.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 -mr-6 pr-6">
                    <div className="space-y-2 p-1">
                        {upcomingCheckouts.length > 0 ? (
                            upcomingCheckouts.map(occupant => (
                            <Card 
                                key={occupant.id} 
                                className="p-4 group shadow-sm"
                            >
                                <div className="flex justify-between items-start">
                                    <div 
                                        className="flex-1 cursor-pointer"
                                        onClick={() => handleOccupantClick(occupant)}
                                    >
                                        <span className="font-semibold group-hover:text-primary">{occupant.fullName}</span>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            {isEmployee(occupant) ? <p>{occupant.zaklad}</p> : <p>Mieszkaniec (NZ)</p>}
                                            <p>{occupant.address || ''} {occupant.roomNumber ? `, pokój ${occupant.roomNumber}` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-primary font-bold whitespace-nowrap">{formatDate(occupant.checkOutDate)}</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8"
                                            onClick={() => handleCopy(occupant)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
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
