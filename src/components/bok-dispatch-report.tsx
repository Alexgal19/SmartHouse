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
import { FilterableHeader } from "@/components/ui/filterable-header";

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
    const [sortBy, setSortBy] = useState<string>("sendDateParsed");
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

    const handleColumnFilterChange = (field: string, values: string[]) => {
        setColumnFilters(prev => ({
            ...prev,
            [field]: values
        }));
    };

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

    const coordinatorOptions = useMemo(() => {
        const coords = new Set(reportData.map(r => r.resident.coordinatorId));
        return Array.from(coords).map(id => ({ value: id, label: getCoordinatorName(id) }));
    }, [reportData]);

    const isAssignedOptions = [
        { value: 'true', label: 'Przypisany' },
        { value: 'false', label: 'Nie przypisany' }
    ];

    const assignedRecordTypeOptions = [
        { value: 'Pracownik', label: 'Pracownik' },
        { value: 'NZ', label: 'NZ' },
        { value: 'null', label: 'Brak' },
    ];

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

        if (columnFilters.coordinatorId?.length > 0) {
            filtered = filtered.filter(entry => columnFilters.coordinatorId.includes(entry.resident.coordinatorId));
        }
        if (columnFilters.isAssigned?.length > 0) {
            filtered = filtered.filter(entry => columnFilters.isAssigned.includes(String(entry.isAssigned)));
        }
        if (columnFilters.assignedRecordType?.length > 0) {
            filtered = filtered.filter(entry => columnFilters.assignedRecordType.includes(String(entry.assignedRecordType)));
        }

        filtered.sort((a, b) => {
            let valA: any;
            let valB: any;

            if (sortBy === 'sendDateParsed') {
                valA = a.sendDateParsed.getTime();
                valB = b.sendDateParsed.getTime();
            } else if (sortBy === 'name') {
                valA = `${a.resident.lastName} ${a.resident.firstName}`;
                valB = `${b.resident.lastName} ${b.resident.firstName}`;
            } else if (sortBy === 'coordinatorId') {
                valA = getCoordinatorName(a.resident.coordinatorId);
                valB = getCoordinatorName(b.resident.coordinatorId);
            } else if (sortBy === 'isAssigned') {
                valA = a.isAssigned ? 1 : 0;
                valB = b.isAssigned ? 1 : 0;
            } else if (sortBy === 'assignedRecordType') {
                valA = a.assignedRecordType || '';
                valB = b.assignedRecordType || '';
            }

            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB, 'pl', { numeric: true }) * (sortOrder === 'asc' ? 1 : -1);
            }

            return (valA > valB ? 1 : -1) * (sortOrder === 'asc' ? 1 : -1);
        });

        return filtered;
    }, [reportData, search, sortOrder]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

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
                                <FilterableHeader field="sendDateParsed" label="Data wysłania" onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder} />
                                <FilterableHeader field="name" label="Nazwisko i Imię" onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder} />
                                <FilterableHeader field="coordinatorId" label="Wysłany do (Koordynator BOK)" options={coordinatorOptions} currentFilterValues={columnFilters.coordinatorId} onFilterChange={handleColumnFilterChange} onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder} />
                                <FilterableHeader field="isAssigned" label="Status Przypisania" options={isAssignedOptions} currentFilterValues={columnFilters.isAssigned} onFilterChange={handleColumnFilterChange} onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder} />
                                <FilterableHeader field="assignedRecordType" label="Znaleziono w Dziale" options={assignedRecordTypeOptions} currentFilterValues={columnFilters.assignedRecordType} onFilterChange={handleColumnFilterChange} onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder} />
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
