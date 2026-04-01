
"use client"
import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Employee, Settings, NonEmployee, SessionData, AddressHistory, BokResident } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Users, UserX, LayoutGrid, List, Trash2, History, Briefcase } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, parse, isValid } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useMainLayout } from '@/components/main-layout';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { BokDispatchReportDialog } from '@/components/bok-dispatch-report';
import { FilterableHeader } from '@/components/ui/filterable-header';

const ITEMS_PER_PAGE = 20;

const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return format(new Date(dateString + 'T00:00:00'), 'dd-MM-yyyy');
        }
        let d = new Date(dateString.replace(' ', 'T'));
        if (isValid(d)) return format(d, 'dd-MM-yyyy');
        d = parse(dateString, 'dd-MM-yyyy HH:mm', new Date());
        if (isValid(d)) return format(d, 'dd-MM-yyyy');
        d = parse(dateString, 'dd-MM-yyyy', new Date());
        if (isValid(d)) return format(d, 'dd-MM-yyyy');
        d = parse(dateString, 'dd.MM.yyyy HH:mm', new Date());
        if (isValid(d)) return format(d, 'dd-MM-yyyy');
        d = parse(dateString, 'dd.MM.yyyy', new Date());
        if (isValid(d)) return format(d, 'dd-MM-yyyy');

        return format(new Date(dateString), 'dd-MM-yyyy');
    } catch {
        return 'Invalid Date';
    }
}

type Entity = Employee | NonEmployee | BokResident;
type SortableField = 'lastName' | 'firstName' | 'coordinatorId' | 'address' | 'roomNumber' | 'checkInDate' | 'checkOutDate' | 'coordinatorName' | 'department' | 'sendDate' | 'zaklad' | 'returnStatus' | 'status' | 'comments';


const isBokResident = (entity: Entity): entity is BokResident => 'role' in entity;
const isEmployee = (entity: Entity): entity is Employee => 'zaklad' in entity && !('role' in entity);

const EntityActions = ({
    entity,
    onEdit,
    onRestore,
    onPermanentDelete,
    isDismissed,
}: {
    entity: Entity;
    onEdit: (entity: Entity) => void;
    onRestore?: (entity: Entity) => void;
    onPermanentDelete: (id: string, type: 'employee' | 'non-employee' | 'bok-resident') => void;
    isDismissed: boolean;
}) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Otwórz menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem onClick={() => onEdit(entity)}>Edytuj</DropdownMenuItem>
                {isDismissed
                    ? <DropdownMenuItem onClick={() => onRestore?.(entity)}>Przywróć</DropdownMenuItem>
                    : <DropdownMenuItem onClick={() => onEdit(entity)}>Zwolnij</DropdownMenuItem>
                }
                <DropdownMenuSeparator />
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                            className="text-destructive"
                            onSelect={(e) => e.preventDefault()}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń na zawsze
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Czy na pewno chcesz trwale usunąć ten wpis?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Ta operacja jest nieodwracalna. Wszystkie dane powiązane z <span className="font-bold">{`${entity.firstName} ${entity.lastName}`}</span> zostaną usunięte na zawsze.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => onPermanentDelete(entity.id, isBokResident(entity) ? 'bok-resident' : (isEmployee(entity) ? 'employee' : 'non-employee'))}
                            >
                                Potwierdź i usuń
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    isDisabled,
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    isDisabled: boolean;
}) => {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center space-x-2 py-4">
            <Button variant="outline" size="icon" onClick={() => onPageChange(1)} disabled={isDisabled || currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={isDisabled || currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
                Strona {currentPage} z {totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={isDisabled || currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(totalPages)} disabled={isDisabled || currentPage === totalPages}>
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    );
};


const EntityTable = ({ entities, onEdit, onRestore, isDismissed, settings, onPermanentDelete, onSort, sortBy, sortOrder, isBokTab, selectedIds, onSelect, onSelectAll, columnFilters, onColumnFilterChange, columnOptions }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onRestore?: (entity: Entity) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee' | 'bok-resident') => void; onSort: (field: SortableField) => void; sortBy: SortableField | null; sortOrder: 'asc' | 'desc'; isBokTab?: boolean; selectedIds?: Set<string>; onSelect?: (id: string, checked: boolean) => void; onSelectAll?: (checked: boolean) => void; columnFilters?: Record<string, string[]>; onColumnFilterChange?: (field: string, values: string[]) => void; columnOptions?: Record<string, { label: string, value: string }[]>; }) => {
    const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

    const renderCheckboxHeader = () => {
        if (!isBokTab || !onSelectAll || !selectedIds) return null;
        const allChecked = entities.length > 0 && selectedIds.size === entities.length;
        const someChecked = selectedIds.size > 0 && selectedIds.size < entities.length;

        return (
            <TableHead className="w-12">
                <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={(checked) => onSelectAll(checked as boolean)}
                    aria-label="Zaznacz wszystkie"
                />
            </TableHead>
        );
    };

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {renderCheckboxHeader()}
                        <FilterableHeader label="Nazwisko" field="lastName" currentFilterValues={columnFilters?.lastName} onFilterChange={onColumnFilterChange} options={columnOptions?.lastName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Imię" field="firstName" currentFilterValues={columnFilters?.firstName} onFilterChange={onColumnFilterChange} options={columnOptions?.firstName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Koordynator" field="coordinatorId" currentFilterValues={columnFilters?.coordinatorId} onFilterChange={onColumnFilterChange} options={columnOptions?.coordinatorId} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {!isBokTab && <FilterableHeader label="Zakład" field="zaklad" currentFilterValues={columnFilters?.zaklad} onFilterChange={onColumnFilterChange} options={columnOptions?.zaklad} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        <FilterableHeader label="Adres" field="address" currentFilterValues={columnFilters?.address} onFilterChange={onColumnFilterChange} options={columnOptions?.address} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Pokój" field="roomNumber" currentFilterValues={columnFilters?.roomNumber} onFilterChange={onColumnFilterChange} options={columnOptions?.roomNumber} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {isBokTab && <FilterableHeader label="Powrót" field="returnStatus" currentFilterValues={columnFilters?.returnStatus} onFilterChange={onColumnFilterChange} options={columnOptions?.returnStatus} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        <FilterableHeader label="Data zameldowania" field="checkInDate" currentFilterValues={columnFilters?.checkInDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkInDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {isBokTab && <FilterableHeader label="Status" field="status" currentFilterValues={columnFilters?.status} onFilterChange={onColumnFilterChange} options={columnOptions?.status} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        {isBokTab && <FilterableHeader label="Data wysłania" field="sendDate" currentFilterValues={columnFilters?.sendDate} onFilterChange={onColumnFilterChange} options={columnOptions?.sendDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        {isBokTab && <FilterableHeader label="Zakład" field="zaklad" currentFilterValues={columnFilters?.zaklad} onFilterChange={onColumnFilterChange} options={columnOptions?.zaklad} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        <FilterableHeader label="Data wymeldowania" field="checkOutDate" currentFilterValues={columnFilters?.checkOutDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkOutDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {isBokTab && <FilterableHeader label="Komentarze" field="comments" currentFilterValues={columnFilters?.comments} onFilterChange={onColumnFilterChange} options={columnOptions?.comments} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        <TableHead><span className="sr-only">Akcje</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entities.length > 0 ? (
                        entities.map((entity) => {
                            const isDispatched = isBokResident(entity) && entity.sendDate;
                            const isSelected = selectedIds?.has(entity.id);

                            return (
                                <TableRow key={entity.id} onClick={(e) => {
                                    // Default row click shouldn't trigger if clicking checkbox
                                    const target = e.target as HTMLElement;
                                    if (target.closest('button[role="checkbox"]')) return;
                                    onEdit(entity);
                                }} className={cn("cursor-pointer", isDispatched && "bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60", isSelected && "bg-muted/50")}>
                                    {isBokTab && onSelect && selectedIds && (
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => onSelect(entity.id, checked as boolean)}
                                                aria-label={`Zaznacz ${entity.firstName} ${entity.lastName}`}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="font-medium">{entity.lastName}</TableCell>
                                    <TableCell className="font-medium">{entity.firstName}</TableCell>
                                    <TableCell>{getCoordinatorName(entity.coordinatorId)}</TableCell>
                                    {!isBokTab && <TableCell>{isEmployee(entity) ? entity.zaklad || '-' : '-'}</TableCell>}
                                    <TableCell>
                                        {isEmployee(entity) && entity.address?.toLowerCase().startsWith('własne mieszkanie')
                                            ? `Własne (${entity.ownAddress || 'Brak danych'})`
                                            : entity.address
                                        }
                                    </TableCell>
                                    <TableCell>{isEmployee(entity) && entity.address?.toLowerCase().startsWith('własne mieszkanie') ? 'N/A' : entity.roomNumber}</TableCell>
                                    {isBokTab && <TableCell>{isBokResident(entity) ? entity.returnStatus || '-' : '-'}</TableCell>}
                                    <TableCell>{formatDate(entity.checkInDate)}</TableCell>
                                    {isBokTab && <TableCell>{isBokResident(entity) ? entity.status || '-' : '-'}</TableCell>}
                                    {isBokTab && <TableCell>{isBokResident(entity) ? formatDate(entity.sendDate) || '-' : '-'}</TableCell>}
                                    {isBokTab && <TableCell>{isBokResident(entity) ? entity.zaklad || '-' : '-'}</TableCell>}
                                    <TableCell>{formatDate(entity.checkOutDate)}</TableCell>
                                    {isBokTab && <TableCell className="max-w-[150px] truncate" title={isBokResident(entity) ? entity.comments || '' : undefined}>{isBokResident(entity) ? entity.comments || '-' : '-'}</TableCell>}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <EntityActions {...{ entity, onEdit, onRestore, onPermanentDelete, isDismissed }} />
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center">Brak danych do wyświetlenia.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

const HistoryTable = ({ history, onSort, sortBy, sortOrder, onDelete, columnFilters, onColumnFilterChange, columnOptions }: { history: AddressHistory[]; onSort: (field: SortableField) => void; sortBy: SortableField | null; sortOrder: 'asc' | 'desc'; onDelete?: (id: string) => void; columnFilters?: Record<string, string[]>; onColumnFilterChange?: (field: string, values: string[]) => void; columnOptions?: Record<string, { label: string, value: string }[]>; }) => {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <FilterableHeader label="Nazwisko" field="lastName" currentFilterValues={columnFilters?.lastName} onFilterChange={onColumnFilterChange} options={columnOptions?.lastName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Imię" field="firstName" currentFilterValues={columnFilters?.firstName} onFilterChange={onColumnFilterChange} options={columnOptions?.firstName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Koordynator" field="coordinatorName" currentFilterValues={columnFilters?.coordinatorName} onFilterChange={onColumnFilterChange} options={columnOptions?.coordinatorName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Zakład" field="department" currentFilterValues={columnFilters?.department} onFilterChange={onColumnFilterChange} options={columnOptions?.department} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Adres" field="address" currentFilterValues={columnFilters?.address} onFilterChange={onColumnFilterChange} options={columnOptions?.address} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Data zameldowania" field="checkInDate" currentFilterValues={columnFilters?.checkInDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkInDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label="Data wymeldowania" field="checkOutDate" currentFilterValues={columnFilters?.checkOutDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkOutDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {onDelete && <TableHead><span className="sr-only">Akcje</span></TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {history.length > 0 ? (
                        history.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell className="font-medium">{entry.employeeLastName}</TableCell>
                                <TableCell className="font-medium">{entry.employeeFirstName}</TableCell>
                                <TableCell>{entry.coordinatorName || 'N/A'}</TableCell>
                                <TableCell>{entry.department || 'N/A'}</TableCell>
                                <TableCell>{entry.address}</TableCell>
                                <TableCell>{formatDate(entry.checkInDate)}</TableCell>
                                <TableCell>{formatDate(entry.checkOutDate)}</TableCell>
                                {onDelete && (
                                    <TableCell>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Czy na pewno chcesz usunąć ten wpis z historii?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Ta operacja jest nieodwracalna i usunie wpis o pobycie <span className="font-bold">{`${entry.employeeFirstName} ${entry.employeeLastName}`.trim()}</span> pod adresem <span className="font-bold">{entry.address}</span>.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-destructive hover:bg-destructive/90"
                                                        onClick={() => onDelete(entry.id)}
                                                    >
                                                        Potwierdź i usuń
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center">Brak danych do wyświetlenia.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

const EntityCardList = ({ entities, onEdit, onRestore, isDismissed, settings, onPermanentDelete }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onRestore?: (entity: Entity) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee' | 'bok-resident') => void; }) => {
    const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

    return (
        <div className="space-y-4">
            {entities.length > 0 ? (
                entities.map((entity, index) => (
                    <Card
                        key={entity.id}
                        onClick={() => onEdit(entity)}
                        className="cursor-pointer animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                    >
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                            <div>
                                <CardTitle className="text-base">{`${entity.firstName} ${entity.lastName}`.trim()}</CardTitle>
                                <CardDescription>
                                    {isBokResident(entity) ? `BOK (${entity.role})` : (isEmployee(entity) ? getCoordinatorName(entity.coordinatorId) : "Mieszkaniec (NZ)")}
                                </CardDescription>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                                <EntityActions {...{ entity, onEdit, onRestore, onPermanentDelete, isDismissed }} />
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p><span className="font-semibold text-muted-foreground">Adres:</span>
                                {isEmployee(entity) && entity.address?.toLowerCase().startsWith('własne mieszkanie')
                                    ? ` ${entity.ownAddress || 'Własne mieszkanie (brak danych)'}`
                                    : ` ${entity.address}, pok. ${entity.roomNumber}`
                                }
                            </p>
                            {isEmployee(entity) && <p><span className="font-semibold text-muted-foreground">Narodowość:</span> {entity.nationality || 'Brak'}</p>}
                            <p><span className="font-semibold text-muted-foreground">Zameldowanie:</span> {formatDate(entity.checkInDate)}</p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center text-muted-foreground py-8">Brak danych do wyświetlenia.</div>
            )}
        </div>
    )
};

const HistoryCardList = ({ history, onDelete }: { history: AddressHistory[]; onDelete?: (id: string) => void; }) => {
    return (
        <div className="space-y-4">
            {history.length > 0 ? (
                history.map((entry, index) => (
                    <Card
                        key={entry.id}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                    >
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                            <div>
                                <CardTitle className="text-base">{`${entry.employeeFirstName} ${entry.employeeLastName}`.trim()}</CardTitle>
                                <CardDescription>
                                    {entry.coordinatorName} - {entry.department}
                                </CardDescription>
                            </div>
                            {onDelete && (
                                <div onClick={(e) => e.stopPropagation()}>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Czy na pewno chcesz usunąć ten wpis z historii?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Ta operacja jest nieodwracalna i usunie wpis o pobycie <span className="font-bold">{`${entry.employeeFirstName} ${entry.employeeLastName}`.trim()}</span> pod adresem <span className="font-bold">{entry.address}</span>.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-destructive hover:bg-destructive/90"
                                                    onClick={() => onDelete(entry.id)}
                                                >
                                                    Potwierdź i usuń
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p><span className="font-semibold text-muted-foreground">Adres:</span> {entry.address}</p>
                            <p><span className="font-semibold text-muted-foreground">Okres:</span> {formatDate(entry.checkInDate)} - {formatDate(entry.checkOutDate)}</p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center text-muted-foreground py-8">Brak danych do wyświetlenia.</div>
            )}
        </div>
    );
};


const ControlPanel = ({
    search,
    onSearch,
    onAdd,
    onViewChange,
    viewMode,
    showAddButton,
    isAdmin,
    isBokTab,
    onOpenReport,
    isDriver,
    selectedIdsSize,
    onBulkDelete,
}: {
    search: string;
    onSearch: (value: string) => void;
    onAdd: (type: 'employee' | 'non-employee' | 'bok-resident') => void;
    onViewChange: (mode: 'list' | 'grid') => void;
    viewMode: 'list' | 'grid';
    showAddButton: boolean;
    isAdmin: boolean;
    isBokTab?: boolean;
    onOpenReport?: () => void;
    isDriver?: boolean;
    selectedIdsSize?: number;
    onBulkDelete?: () => void;
}) => {
    const { isMobile } = useIsMobile();
    const [localSearch, setLocalSearch] = useState(search);

    useEffect(() => {
        setLocalSearch(search);
    }, [search]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== search) {
                onSearch(localSearch);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch, search, onSearch]);

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Zarządzanie mieszkańcami</CardTitle>
            <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">
                <Input
                    placeholder="Szukaj po nazwisku..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="w-full sm:w-auto flex-1"
                />
                <div className="flex gap-2">
                    {isBokTab && selectedIdsSize !== undefined && selectedIdsSize > 0 && onBulkDelete && (
                        <Button type="button" variant="destructive" onClick={onBulkDelete} className="hidden sm:inline-flex">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń zaznaczone ({selectedIdsSize})
                        </Button>
                    )}
                    {isBokTab && selectedIdsSize !== undefined && selectedIdsSize > 0 && onBulkDelete && isMobile && (
                        <Button type="button" variant="destructive" size="icon" onClick={onBulkDelete}>
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    )}
                    {isBokTab && onOpenReport && (
                        <Button variant="outline" className="hidden sm:inline-flex bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 dark:border-green-800" onClick={onOpenReport}>
                            Raport wysłanych
                        </Button>
                    )}
                    {showAddButton && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size={isMobile ? "icon" : "default"}>
                                    <PlusCircle className={isMobile ? "h-5 w-5" : "mr-2 h-4 w-4"} />
                                    <span className="hidden sm:inline">Dodaj</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                                {(!isDriver || isAdmin) && (
                                    <>
                                        <DropdownMenuItem onClick={() => onAdd('employee')}>Dodaj pracownika</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onAdd('non-employee')}>Dodaj mieszkańca (NZ)</DropdownMenuItem>
                                    </>
                                )}
                                {(isAdmin || isDriver) && <DropdownMenuItem onClick={() => onAdd('bok-resident')}>Dodaj mieszkańca BOK</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {!isMobile && (
                        <>
                            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => onViewChange('list')}>
                                <List className="h-4 w-4" />
                            </Button>
                            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => onViewChange('grid')}>
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function EntityView({ currentUser }: { currentUser: SessionData }) {
    const { handleBulkDeleteBokResidents } = useMainLayout();
    const {
        allEmployees,
        allNonEmployees,
        allBokResidents,
        addressHistory,
        settings,
        handleRestoreEmployee,
        handleRestoreNonEmployee,
        handleRestoreBokResident,
        handleDeleteEmployee,
        handleEditEmployeeClick,
        handleEditNonEmployeeClick,
        handleAddEmployeeClick,
        handleAddNonEmployeeClick,
        handleDeleteNonEmployee,
        handleAddBokResidentClick,
        handleEditBokResidentClick,
        handleDeleteBokResident,
        handleDeleteAddressHistory,
    } = useMainLayout();

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [isReportOpen, setIsReportOpen] = useState(false);
    const { isMobile, isMounted } = useIsMobile();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const tab = (searchParams.get('tab') as 'active' | 'dismissed' | 'non-employees' | 'bok-residents' | 'history') || (currentUser.isDriver ? 'bok-residents' : 'active');
    const [bokSubTab, setBokSubTab] = useState<'active' | 'sent' | 'dismissed'>('active');

    // Clear selections when tab or subtab changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [tab, bokSubTab]);

    const page = Number(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const viewMode = (searchParams.get('viewMode') as 'list' | 'grid') || (isMobile ? 'grid' : 'list');

    const isDriver = currentUser.isDriver;

    const defaultSortField = useMemo(() => {
        switch (tab) {
            case 'active':
                return 'checkInDate';
            case 'dismissed':
            case 'history':
            case 'non-employees':
            case 'bok-residents':
                return 'checkOutDate';
            default:
                return 'lastName';
        }
    }, [tab]);

    const sortBy = (searchParams.get('sortBy') as SortableField) || defaultSortField;
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

    const handleColumnFilterChange = (field: string, values: string[]) => {
        setColumnFilters(prev => ({ ...prev, [field]: values }));
    };

    const updateSearchParams = (newParams: Record<string, string | number>) => {
        startTransition(() => {
            const current = new URLSearchParams(Array.from(searchParams.entries()));
            for (const [key, value] of Object.entries(newParams)) {
                if (value) {
                    current.set(key, String(value));
                } else {
                    current.delete(key);
                }
            }
            if (Object.keys(newParams).some(k => k !== 'page')) {
                current.delete('page');
            }
            router.push(`${pathname}?${current.toString()}`);
        });
    };

    const handleSort = (field: SortableField) => {
        const newSortOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
        updateSearchParams({ sortBy: field, sortOrder: newSortOrder });
    }

    const filteredAndSortedData = useMemo(() => {
        if (!allEmployees || !allNonEmployees || !allBokResidents || !addressHistory || !settings) return {};

        const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

        const filterAndSort = <T extends Entity | AddressHistory>(dataToProcess: T[], isHistory: boolean = false): T[] => {
            const filtered = dataToProcess.filter(entity => {
                const searchMatch = search === '' ||
                    ('firstName' in entity && entity.firstName && entity.firstName.toLowerCase().includes(search.toLowerCase())) ||
                    ('lastName' in entity && entity.lastName && entity.lastName.toLowerCase().includes(search.toLowerCase())) ||
                    (isHistory && 'employeeFirstName' in entity && entity.employeeFirstName && entity.employeeFirstName.toLowerCase().includes(search.toLowerCase())) ||
                    (isHistory && 'employeeLastName' in entity && entity.employeeLastName && entity.employeeLastName.toLowerCase().includes(search.toLowerCase()));

                if (!searchMatch) return false;

                let columnMatch = true;
                Object.entries(columnFilters).forEach(([colField, activeVals]) => {
                    if (!activeVals || activeVals.length === 0) return;

                    let entityVal = '';
                    if (colField === 'coordinatorId' && 'coordinatorId' in entity && entity.coordinatorId) {
                        entityVal = getCoordinatorName(entity.coordinatorId);
                    } else if (colField === 'coordinatorName' && 'coordinatorName' in entity) {
                        entityVal = (entity as Record<string, unknown>).coordinatorName as string || '';
                    } else if (colField in entity) {
                        const rawVal = (entity as Record<string, unknown>)[colField];
                        if (colField.includes('Date') && rawVal) {
                            entityVal = formatDate(rawVal as string);
                        } else {
                            entityVal = String(rawVal || '');
                        }
                    }
                    if (!activeVals.includes(entityVal)) {
                        columnMatch = false;
                    }
                });

                return columnMatch;
            });

            return [...filtered].sort((a, b) => {
                const aName = isHistory ? (a as unknown as AddressHistory).employeeLastName : (a as unknown as Entity).lastName;
                const bName = isHistory ? (b as unknown as AddressHistory).employeeLastName : (b as unknown as Entity).lastName;
                const aFirstName = isHistory ? (a as unknown as AddressHistory).employeeFirstName : (a as unknown as Entity).firstName;
                const bFirstName = isHistory ? (b as unknown as AddressHistory).employeeFirstName : (b as unknown as Entity).firstName;

                if (sortBy === 'lastName') {
                    const lastNameCompare = (aName || '').localeCompare(bName || '', 'pl');
                    if (lastNameCompare !== 0) return lastNameCompare * (sortOrder === 'asc' ? 1 : -1);
                    return (aFirstName || '').localeCompare(bFirstName || '', 'pl') * (sortOrder === 'asc' ? 1 : -1);
                }

                if (sortBy === 'firstName') {
                    const firstNameCompare = (aFirstName || '').localeCompare(bFirstName || '', 'pl');
                    if (firstNameCompare !== 0) return firstNameCompare * (sortOrder === 'asc' ? 1 : -1);
                    return (aName || '').localeCompare(bName || '', 'pl') * (sortOrder === 'asc' ? 1 : -1);
                }

                let valA: string | number | null | undefined;
                let valB: string | number | null | undefined;

                if (sortBy === 'coordinatorId' && 'coordinatorId' in a && 'coordinatorId' in b) {
                    valA = getCoordinatorName(a.coordinatorId);
                    valB = getCoordinatorName(b.coordinatorId);
                } else {
                    valA = (a as { [K in SortableField]?: string | number | null })[sortBy];
                    valB = (b as { [K in SortableField]?: string | number | null })[sortBy];
                }

                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;

                if (sortBy.includes('Date')) {
                    const dateA = valA ? parseISO(valA as string).getTime() : 0;
                    const dateB = valB ? parseISO(valB as string).getTime() : 0;
                    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                }

                return String(valA).localeCompare(String(valB), 'pl', { numeric: true }) * (sortOrder === 'asc' ? 1 : -1);
            });
        };

        const filteredEmployees = filterAndSort(allEmployees);
        const filteredNonEmployees = filterAndSort(allNonEmployees);
        const filteredBokResidents = filterAndSort(allBokResidents);
        const filteredHistory = filterAndSort(addressHistory, true);

        return {
            activeEmployees: filteredEmployees.filter(e => e.status === 'active'),
            dismissedEmployees: filteredEmployees.filter(e => e.status === 'dismissed'),
            activeNonEmployees: filteredNonEmployees.filter(ne => ne.status !== 'dismissed'),
            dismissedNonEmployees: filteredNonEmployees.filter(ne => ne.status === 'dismissed'),
            // Aktywni: no sendDate, no dismissDate, not dismissed
            activeBokResidents: filteredBokResidents.filter(b =>
                b.status !== 'dismissed' && !b.dismissDate && !b.sendDate
            ),
            // Wyslani: has sendDate, not yet dismissed
            sentBokResidents: filteredBokResidents.filter(b =>
                b.status !== 'dismissed' && !b.dismissDate && !!b.sendDate
            ),
            // Zwolnieni: dismissed status OR has dismissDate
            dismissedBokResidents: filteredBokResidents.filter(b =>
                b.status === 'dismissed' || !!b.dismissDate
            ),
            history: filteredHistory,
        }

    }, [allEmployees, allNonEmployees, allBokResidents, addressHistory, settings, search, sortBy, sortOrder, columnFilters]);


    const dataMap = useMemo(() => ({
        active: filteredAndSortedData.activeEmployees || [],
        dismissed: [...(filteredAndSortedData.dismissedEmployees || []), ...(filteredAndSortedData.dismissedNonEmployees || [])],
        'non-employees': filteredAndSortedData.activeNonEmployees || [],
        'bok-residents': filteredAndSortedData.activeBokResidents || [],
        history: filteredAndSortedData.history || [],
    }), [filteredAndSortedData]);

    const bokData = useMemo(() => {
        return bokSubTab === 'active'
            ? (filteredAndSortedData.activeBokResidents || [])
            : bokSubTab === 'sent'
                ? (filteredAndSortedData.sentBokResidents || [])
                : (filteredAndSortedData.dismissedBokResidents || []);
    }, [bokSubTab, filteredAndSortedData]);

    const bokTotalCount = (filteredAndSortedData.activeBokResidents?.length || 0)
        + (filteredAndSortedData.sentBokResidents?.length || 0)
        + (filteredAndSortedData.dismissedBokResidents?.length || 0);

    const currentData = dataMap[tab];
    const totalPages = Math.ceil((currentData?.length || 0) / ITEMS_PER_PAGE);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return currentData?.slice(start, end) || [];
    }, [currentData, page]);


    const columnOptions = useMemo(() => {
        const options: Record<string, { label: string, value: string }[]> = {};
        const dataToAnalyze = tab === 'bok-residents' ? bokData : tab === 'history' ? dataMap.history : currentData;

        if (!dataToAnalyze || dataToAnalyze.length === 0) return options;

        const addOptions = (field: string, extractValue: (item: Entity | AddressHistory) => string | undefined) => {
            const values = new Set<string>();
            dataToAnalyze.forEach(item => {
                const val = extractValue(item);
                if (val !== undefined && val !== null && val !== '') {
                    values.add(val);
                }
            });
            options[field] = Array.from(values).sort((a, b) => a.localeCompare(b, 'pl', { numeric: true })).map(v => ({ label: v, value: v }));
        };

        if (tab === 'history') {
            addOptions('coordinatorName', item => (item as AddressHistory).coordinatorName);
            addOptions('department', item => (item as AddressHistory).department);
            addOptions('address', item => (item as AddressHistory).address);
            addOptions('checkInDate', item => formatDate((item as AddressHistory).checkInDate));
            addOptions('checkOutDate', item => formatDate((item as AddressHistory).checkOutDate));
        } else {
            addOptions('coordinatorId', item => {
                if ('coordinatorId' in item) {
                    return settings?.coordinators.find(c => c.uid === item.coordinatorId)?.name || 'N/A';
                }
                return undefined;
            });
            addOptions('address', item => {
                const rec = item as Record<string, unknown>;
                if (isEmployee(item as Entity) && (rec.address as string | undefined)?.toLowerCase().startsWith('własne mieszkanie')) {
                     return `Własne (${(rec.ownAddress as string) || 'Brak danych'})`;
                }
                return rec.address as string;
            });
            addOptions('roomNumber', item => {
                 const rec = item as Record<string, unknown>;
                 if (isEmployee(item as Entity) && (rec.address as string | undefined)?.toLowerCase().startsWith('własne mieszkanie')) return 'N/A';
                 return rec.roomNumber as string;
            });
            addOptions('checkInDate', item => formatDate((item as Record<string, unknown>).checkInDate as string));
            addOptions('checkOutDate', item => formatDate((item as Record<string, unknown>).checkOutDate as string));
            addOptions('zaklad', item => ('zaklad' in item) ? (item as Record<string, unknown>).zaklad as string : undefined);
            if (tab === 'bok-residents') {
                 addOptions('sendDate', item => ('sendDate' in item && (item as Record<string, unknown>).sendDate) ? formatDate((item as Record<string, unknown>).sendDate as string) : undefined);
                 addOptions('returnStatus', item => ('returnStatus' in item) ? (item as Record<string, unknown>).returnStatus as string : undefined);
                 addOptions('status', item => ('status' in item) ? (item as Record<string, unknown>).status as string : undefined);
                 addOptions('comments', item => ('comments' in item) ? (item as Record<string, unknown>).comments as string : undefined);
            }
        }

        return options;
    }, [tab, bokData, dataMap.history, currentData, settings]);

    if (!settings || !allEmployees || !allNonEmployees || !allBokResidents || !addressHistory) {
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

    const handleRestore = async (entity: Entity) => {
        if (isBokResident(entity)) {
            await handleRestoreBokResident(entity);
        } else if (isEmployee(entity)) {
            await handleRestoreEmployee(entity);
        } else {
            await handleRestoreNonEmployee(entity as NonEmployee);
        }
    };

    const handlePermanentDelete = async (id: string, type: 'employee' | 'non-employee' | 'bok-resident') => {
        if (type === 'employee') {
            await handleDeleteEmployee(id, currentUser.uid);
        } else if (type === 'bok-resident') {
            await handleDeleteBokResident(id, currentUser.uid);
        } else {
            await handleDeleteNonEmployee(id, currentUser.uid);
        }
    };

    const handleEdit = (entity: Entity) => {
        if (isBokResident(entity)) {
            handleEditBokResidentClick(entity);
        } else if (isEmployee(entity)) {
            handleEditEmployeeClick(entity);
        } else {
            handleEditNonEmployeeClick(entity as NonEmployee);
        }
    }

    const handleAdd = (type: 'employee' | 'non-employee' | 'bok-resident') => {
        if (type === 'non-employee') {
            handleAddNonEmployeeClick();
        } else if (type === 'bok-resident') {
            handleAddBokResidentClick();
        } else {
            handleAddEmployeeClick();
        }
    }



    const renderContent = (data: Entity[]) => (
        <>
            <ScrollArea className="h-[55vh] overflow-x-auto" style={{ opacity: isPending ? 0.6 : 1 }}>
                {isMounted ?
                    (viewMode === 'list' ?
                        <EntityTable
                            entities={data}
                            settings={settings}
                            onEdit={handleEdit}
                            onRestore={handleRestore}
                            onPermanentDelete={handlePermanentDelete}
                            isDismissed={tab === 'dismissed'}
                            onSort={handleSort}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            isBokTab={tab === 'bok-residents'}
                            selectedIds={selectedIds}
                            onSelect={(id, checked) => {
                                const newSet = new Set(Array.from(selectedIds));
                                if (checked) newSet.add(id); else newSet.delete(id);
                                setSelectedIds(newSet);
                            }}
                            onSelectAll={(checked) => setSelectedIds(checked ? new Set(data.map(e => e.id)) : new Set())}
                            columnFilters={columnFilters}
                            onColumnFilterChange={handleColumnFilterChange}
                            columnOptions={columnOptions}
                        /> :
                        <EntityCardList
                            entities={data}
                            settings={settings}
                            onEdit={handleEdit}
                            onRestore={handleRestore}
                            onPermanentDelete={handlePermanentDelete}
                            isDismissed={tab === 'dismissed'}
                        />
                    )
                    : <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={(p) => updateSearchParams({ page: p })} isDisabled={isPending} />
        </>
    );

    const renderHistoryContent = () => (
        <>
            <ScrollArea className="h-[55vh] overflow-x-auto" style={{ opacity: isPending ? 0.6 : 1 }}>
                {isMounted ? (
                    isMobile ? (
                        <HistoryCardList
                            history={paginatedData as AddressHistory[]}
                            onDelete={currentUser.isAdmin ? (id) => handleDeleteAddressHistory(id, currentUser.uid) : undefined}
                        />
                    ) : (
                        <HistoryTable
                            history={paginatedData as AddressHistory[]}
                            onSort={handleSort}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onDelete={currentUser.isAdmin ? (id) => handleDeleteAddressHistory(id, currentUser.uid) : undefined}
                            columnFilters={columnFilters}
                            onColumnFilterChange={handleColumnFilterChange}
                            columnOptions={columnOptions}
                        />
                    )
                ) : (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                )}
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={(p) => updateSearchParams({ page: p })} isDisabled={isPending} />
        </>
    );

    const tabsListContent = (
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-2 bg-transparent p-0">
            {!isDriver && (
                <>
                    <TabsTrigger value="active" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                        <Users className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">Aktywni ({dataMap.active.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="dismissed" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                        <UserX className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">Zwolnieni ({dataMap.dismissed.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="non-employees" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                        <UserX className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">NZ ({dataMap['non-employees'].length})</span>
                    </TabsTrigger>
                </>
            )}
            {(currentUser.isAdmin || isDriver) && (
                <TabsTrigger value="bok-residents" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                    <Briefcase className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">BOK ({bokTotalCount})</span>
                </TabsTrigger>
            )}
            {!isDriver && (
                <TabsTrigger value="history" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                    <History className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Historia ({dataMap.history.length})</span>
                </TabsTrigger>
            )}
        </TabsList>
    );

    return (
        <Card>
            <CardHeader>
                <ControlPanel
                    search={search}
                    onSearch={(val) => updateSearchParams({ search: val, page: 1 })}
                    onAdd={handleAdd}
                    viewMode={viewMode}
                    onViewChange={(mode) => updateSearchParams({ viewMode: mode })}
                    showAddButton={tab !== 'history'}
                    isAdmin={currentUser.isAdmin}
                    isBokTab={tab === 'bok-residents'}
                    onOpenReport={() => setIsReportOpen(true)}
                    isDriver={isDriver}
                    selectedIdsSize={selectedIds.size}
                    onBulkDelete={() => {
                        if (selectedIds.size > 0 && confirm(`Czy na pewno chcesz usunąć ${selectedIds.size} zaznaczonych mieszkańców BOK? Ta akcja jest nieodwracalna.`)) {
                            handleBulkDeleteBokResidents(Array.from(selectedIds)).then(() => {
                                setSelectedIds(new Set());
                            });
                        }
                    }}
                />
            </CardHeader>
            <CardContent>
                <Tabs value={tab} onValueChange={(v) => updateSearchParams({ tab: v, page: 1, sortBy: '', sortOrder: '' })}>
                    <div className="w-full mb-6 relative">
                        {tabsListContent}
                    </div>
                    {!isDriver && (
                        <>
                            <TabsContent value="active" className="mt-4">{renderContent(paginatedData as Entity[])}</TabsContent>
                            <TabsContent value="dismissed" className="mt-4">{renderContent(paginatedData as Entity[])}</TabsContent>
                            <TabsContent value="non-employees" className="mt-4">{renderContent(paginatedData as Entity[])}</TabsContent>
                        </>
                    )}
                    {(currentUser.isAdmin || isDriver) && (
                        <TabsContent value="bok-residents" className="mt-4">
                            {/* Inner sub-tabs: Aktywni / Wyslani / Zwolnieni */}
                            <Tabs value={bokSubTab} onValueChange={(v) => setBokSubTab(v as 'active' | 'sent' | 'dismissed')} className="mb-4">
                                <TabsList className="h-auto bg-muted/50 p-1 rounded-md">
                                    <TabsTrigger value="active" className="rounded px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                        <Users className="mr-2 h-3.5 w-3.5 shrink-0" />
                                        Aktywni ({filteredAndSortedData.activeBokResidents?.length || 0})
                                    </TabsTrigger>
                                    <TabsTrigger value="sent" className="rounded px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                        <Briefcase className="mr-2 h-3.5 w-3.5 shrink-0" />
                                        Wyslani ({filteredAndSortedData.sentBokResidents?.length || 0})
                                    </TabsTrigger>
                                    <TabsTrigger value="dismissed" className="rounded px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                        <UserX className="mr-2 h-3.5 w-3.5 shrink-0" />
                                        Zwolnieni ({filteredAndSortedData.dismissedBokResidents?.length || 0})
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <ScrollArea className="h-[55vh] overflow-x-auto" style={{ opacity: isPending ? 0.6 : 1 }}>
                                {isMounted ? (
                                    viewMode === 'list' ? (
                                        <EntityTable
                                            entities={bokData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)}
                                            settings={settings}
                                            onEdit={handleEdit}
                                            onRestore={bokSubTab === 'dismissed' ? handleRestore : undefined}
                                            onPermanentDelete={handlePermanentDelete}
                                            isDismissed={bokSubTab === 'dismissed'}
                                            onSort={handleSort}
                                            sortBy={sortBy}
                                            sortOrder={sortOrder}
                                            isBokTab
                                            selectedIds={selectedIds}
                                            onSelect={(id, checked) => {
                                                const newSet = new Set(selectedIds);
                                                if (checked) newSet.add(id);
                                                else newSet.delete(id);
                                                setSelectedIds(newSet);
                                            }}
                                            onSelectAll={(checked) => {
                                                if (checked) {
                                                    const pageData = bokData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
                                                    setSelectedIds(new Set(pageData.map(e => e.id)));
                                                } else {
                                                    setSelectedIds(new Set());
                                                }
                                            }}
                                            columnFilters={columnFilters}
                                            onColumnFilterChange={handleColumnFilterChange}
                                            columnOptions={columnOptions}
                                        />
                                    ) : (
                                        <EntityCardList
                                            entities={bokData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)}
                                            settings={settings}
                                            onEdit={handleEdit}
                                            onRestore={bokSubTab === 'dismissed' ? handleRestore : undefined}
                                            onPermanentDelete={handlePermanentDelete}
                                            isDismissed={bokSubTab === 'dismissed'}
                                        />
                                    )
                                ) : (
                                    <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
                                )}
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                            <PaginationControls
                                currentPage={page}
                                totalPages={Math.ceil(bokData.length / ITEMS_PER_PAGE)}
                                onPageChange={(p) => updateSearchParams({ page: p })}
                                isDisabled={isPending}
                            />
                        </TabsContent>
                    )}
                    {!isDriver && <TabsContent value="history" className="mt-4">{renderHistoryContent()}</TabsContent>}
                </Tabs>
            </CardContent>

            {allEmployees && allNonEmployees && allBokResidents && settings && (
                <BokDispatchReportDialog
                    isOpen={isReportOpen}
                    onOpenChange={setIsReportOpen}
                    bokResidents={allBokResidents}
                    employees={allEmployees}
                    nonEmployees={allNonEmployees}
                    settings={settings}
                    onPermanentDelete={(id) => handlePermanentDelete(id, 'bok-resident')}
                />
            )}
        </Card>
    )
}

