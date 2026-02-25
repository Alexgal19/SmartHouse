"use client";

import { useMemo, useState } from "react";
import { format, parse, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Employee, NonEmployee, BokResident, Settings } from "@/types";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface BokDispatchReportProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    bokResidents: BokResident[];
    employees: Employee[];
    nonEmployees: NonEmployee[];
    settings: Settings;
    onPermanentDelete?: (id: string) => void;
}

type ReportEntry = {
    resident: BokResident;
    isAssigned: boolean;
    assignedCoordinatorName: string | null;
    assignedRecordType: 'Pracownik' | 'NZ' | null;
    sendDateParsed: Date;
};

const parseSendDate = (dateStr: string | null): Date => {
    if (!dateStr) return new Date(0);
    let d = new Date(dateStr.replace(' ', 'T'));
    if (isValid(d)) return d;
    d = parse(dateStr, 'dd-MM-yyyy HH:mm', new Date());
    if (isValid(d)) return d;
    d = parse(dateStr, 'dd-MM-yyyy', new Date());
    if (isValid(d)) return d;
    d = parse(dateStr, 'dd.MM.yyyy HH:mm', new Date());
    if (isValid(d)) return d;
    d = parse(dateStr, 'dd.MM.yyyy', new Date());
    if (isValid(d)) return d;
    return new Date(0);
}

export function BokDispatchReportDialog({
    isOpen,
    onOpenChange,
    bokResidents,
    employees,
    nonEmployees,
    settings,
    onPermanentDelete
}: BokDispatchReportProps) {
    const [search, setSearch] = useState("");
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || id;

    const reportData = useMemo(() => {
        // 1. Filtruj tylko wysłanych
        const dispatched = bokResidents.filter(r => r.sendDate !== null && r.sendDate !== "");

        return dispatched.map(resident => {
            // 2. Szukaj matchy w Employee i NonEmployee po imieniu i nazwisku (ignorując wielkość liter)
            const firstNameLower = resident.firstName.trim().toLowerCase();
            const lastNameLower = resident.lastName.trim().toLowerCase();

            // Z uwagi na literówki, idealnie byłoby normalize(), ale zostawiamy trim i lower
            const empMatch = employees.find(e =>
                e.firstName?.trim().toLowerCase() === firstNameLower &&
                e.lastName?.trim().toLowerCase() === lastNameLower
            );

            const nonEmpMatch = nonEmployees.find(e =>
                e.firstName?.trim().toLowerCase() === firstNameLower &&
                e.lastName?.trim().toLowerCase() === lastNameLower
            );

            const match = empMatch || nonEmpMatch;
            const isAssigned = !!match;

            const sendDateParsed = parseSendDate(resident.sendDate);

            return {
                resident,
                isAssigned,
                assignedCoordinatorName: match ? getCoordinatorName(match.coordinatorId) : null,
                assignedRecordType: empMatch ? 'Pracownik' : (nonEmpMatch ? 'NZ' : null),
                sendDateParsed
            } as ReportEntry;
        });
    }, [bokResidents, employees, nonEmployees, settings]);

    const filteredAndSortedData = useMemo(() => {
        let filtered = reportData.filter(entry =>
            entry.resident.lastName.toLowerCase().includes(search.toLowerCase()) ||
            entry.resident.firstName.toLowerCase().includes(search.toLowerCase())
        );

        if (dateFrom) {
            const from = new Date(dateFrom);
            from.setHours(0, 0, 0, 0);
            filtered = filtered.filter(entry => entry.sendDateParsed >= from);
        }

        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            filtered = filtered.filter(entry => entry.sendDateParsed <= to);
        }

        filtered.sort((a, b) => {
            const timeA = a.sendDateParsed.getTime();
            const timeB = b.sendDateParsed.getTime();
            if (sortOrder === 'desc') return timeB - timeA;
            return timeA - timeB;
        });

        return filtered;
    }, [reportData, search, sortOrder]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="text-xl">Raport Wysłanych Mieszkańców BOK</DialogTitle>
                    <div className="flex items-center justify-between pt-4 gap-4 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Input
                                placeholder="Szukaj osoby..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-[180px]"
                            />
                            <div className="flex items-center gap-2 ml-2">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">Od:</span>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="w-[130px]"
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">Do:</span>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="w-[130px]"
                                />
                            </div>
                        </div>
                        <div className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                            Razem: {filteredAndSortedData.length}
                        </div>
                    </div>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead>Data wysłania</TableHead>
                                <TableHead>Nazwisko i Imię</TableHead>
                                <TableHead>Wysłany do (Koordynator BOK)</TableHead>
                                <TableHead>Status Przypisania</TableHead>
                                <TableHead>Znaleziono w Dziale</TableHead>
                                <TableHead className="w-[80px] text-right">Akcje</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Brak dopasowań do wyszukiwania lub brak wysłanych pracowników.</TableCell>
                                </TableRow>
                            ) : (
                                filteredAndSortedData.map(({ resident, isAssigned, assignedRecordType, assignedCoordinatorName, sendDateParsed }) => (
                                    <TableRow key={resident.id}>
                                        <TableCell className="font-medium whitespace-nowrap">
                                            {sendDateParsed.getTime() > 0 ? format(sendDateParsed, 'dd-MM-yyyy', { locale: pl }) : 'Brak daty'}
                                        </TableCell>
                                        <TableCell>{resident.lastName} {resident.firstName}</TableCell>
                                        <TableCell>{getCoordinatorName(resident.coordinatorId)}</TableCell>
                                        <TableCell>
                                            {isAssigned ? (
                                                <Badge className="bg-green-600 hover:bg-green-700">Przypisany</Badge>
                                            ) : (
                                                <Badge variant="destructive">Nie przypisany</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isAssigned ? (
                                                <div className="flex flex-col text-sm">
                                                    <span className="font-medium text-green-700 dark:text-green-500">{assignedCoordinatorName}</span>
                                                    <span className="text-xs text-muted-foreground">jako {assignedRecordType}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {onPermanentDelete && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Czy na pewno chcesz usunąć z bazy ten wpis z BOK?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Ta operacja jest nieodwracalna. Wpis <span className="font-bold">{`${resident.firstName} ${resident.lastName}`}</span> zostanie definitywnie wykreślony z bazy raportów.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onPermanentDelete(resident.id)}>
                                                                Potwierdź i usuń
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
