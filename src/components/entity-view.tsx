
"use client"
import React, { useState, useMemo, useTransition, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Employee, Settings, NonEmployee, SessionData, AddressHistory, BokResident } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Users, UserX, LayoutGrid, List, Trash2, History, Download, Briefcase } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, parse, isValid } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useMainLayout } from '@/components/main-layout';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

import { FilterableHeader } from '@/components/ui/filterable-header';
import { BokStatsDrillDownDialog } from '@/components/bok-stats-drill-down-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
type SortableField = 'lastName' | 'firstName' | 'coordinatorId' | 'address' | 'roomNumber' | 'checkInDate' | 'checkOutDate' | 'coordinatorName' | 'department' | 'sendDate' | 'zaklad' | 'returnStatus' | 'status' | 'comments' | 'passportNumber' | 'hasPermit' | 'hasPesel';


const isBokResident = (entity: Entity): entity is BokResident => !('coordinatorId' in entity);
const isEmployee = (entity: Entity): entity is Employee => ('coordinatorId' in entity) && ('zaklad' in entity);

const EntityActions = React.memo(({
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
    const { t } = useLanguage();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">{t('entity.openMenu')}</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem onClick={() => onEdit(entity)}>{t('common.edit')}</DropdownMenuItem>
                {isDismissed
                    ? <DropdownMenuItem onClick={() => onRestore?.(entity)}>{t('common.restore')}</DropdownMenuItem>
                    : <DropdownMenuItem onClick={() => onEdit(entity)}>{t('entity.dismiss')}</DropdownMenuItem>
                }
                <DropdownMenuSeparator />
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                            className="text-destructive"
                            onSelect={(e) => e.preventDefault()}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('entity.deletePermanently')}
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('entity.confirmDeleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('entity.confirmDeleteDesc', { name: `${entity.firstName} ${entity.lastName}` })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => onPermanentDelete(entity.id, isBokResident(entity) ? 'bok-resident' : (isEmployee(entity) ? 'employee' : 'non-employee'))}
                            >
                                {t('entity.confirmDelete')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
});
EntityActions.displayName = 'EntityActions';


const PaginationControls = React.memo(({
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
    const { t } = useLanguage();
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
                {t('entity.page', { current: currentPage, total: totalPages })}
            </span>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={isDisabled || currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(totalPages)} disabled={isDisabled || currentPage === totalPages}>
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    );
});
PaginationControls.displayName = 'PaginationControls';


const EntityTable = React.memo(({ entities, onEdit, onRestore, isDismissed, settings, onPermanentDelete, onSort, sortBy, sortOrder, isBokTab, columnFilters, onColumnFilterChange, columnOptions, bokPendingIds }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onRestore?: (entity: Entity) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee' | 'bok-resident') => void; onSort: (field: SortableField) => void; sortBy: SortableField | null; sortOrder: 'asc' | 'desc'; isBokTab?: boolean; columnFilters?: Record<string, string[]>; onColumnFilterChange?: (field: string, values: string[]) => void; columnOptions?: Record<string, { label: string, value: string }[]>; bokPendingIds?: Set<string>; }) => {
    const { t } = useLanguage();
    const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <FilterableHeader label={t('col.lastName')} field="lastName" currentFilterValues={columnFilters?.lastName} onFilterChange={onColumnFilterChange} options={columnOptions?.lastName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.firstName')} field="firstName" currentFilterValues={columnFilters?.firstName} onFilterChange={onColumnFilterChange} options={columnOptions?.firstName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {!isBokTab && <FilterableHeader label={t('col.coordinator')} field="coordinatorId" currentFilterValues={columnFilters?.coordinatorId} onFilterChange={onColumnFilterChange} options={columnOptions?.coordinatorId} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        {!isBokTab && <FilterableHeader label={t('col.department')} field="zaklad" currentFilterValues={columnFilters?.zaklad} onFilterChange={onColumnFilterChange} options={columnOptions?.zaklad} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        <FilterableHeader label={t('col.address')} field="address" currentFilterValues={columnFilters?.address} onFilterChange={onColumnFilterChange} options={columnOptions?.address} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.room')} field="roomNumber" currentFilterValues={columnFilters?.roomNumber} onFilterChange={onColumnFilterChange} options={columnOptions?.roomNumber} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.checkIn')} field="checkInDate" currentFilterValues={columnFilters?.checkInDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkInDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {isBokTab && <FilterableHeader label={t('col.passport')} field="passportNumber" currentFilterValues={columnFilters?.passportNumber} onFilterChange={onColumnFilterChange} options={columnOptions?.passportNumber} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        {isBokTab && <FilterableHeader label={t('col.comments')} field="comments" currentFilterValues={columnFilters?.comments} onFilterChange={onColumnFilterChange} options={columnOptions?.comments} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        {isBokTab && <FilterableHeader label={t('col.hasPermit')} field="hasPermit" currentFilterValues={columnFilters?.hasPermit} onFilterChange={onColumnFilterChange} options={columnOptions?.hasPermit} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        {isBokTab && <FilterableHeader label={t('col.hasPesel')} field="hasPesel" currentFilterValues={columnFilters?.hasPesel} onFilterChange={onColumnFilterChange} options={columnOptions?.hasPesel} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />}
                        <FilterableHeader label={t('col.checkOut')} field="checkOutDate" currentFilterValues={columnFilters?.checkOutDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkOutDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <TableHead><span className="sr-only">{t('col.actions')}</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entities.length > 0 ? (
                        entities.map((entity) => {
                            const isPending = isBokTab && isBokResident(entity) && bokPendingIds?.has(entity.id);
                            return (
                                <TableRow
                                    key={entity.id}
                                    onClick={() => onEdit(entity)}
                                    className={cn(
                                        'cursor-pointer',
                                        isPending && 'animate-blink-red'
                                    )}
                                >
                                    <TableCell className="font-medium">{entity.lastName}</TableCell>
                                    <TableCell className="font-medium">{entity.firstName}</TableCell>
                                    {!isBokTab && <TableCell>{'coordinatorId' in entity ? getCoordinatorName(entity.coordinatorId) : '-'}</TableCell>}
                                    {!isBokTab && <TableCell>{isEmployee(entity) ? entity.zaklad || '-' : '-'}</TableCell>}
                                    <TableCell>
                                        {isEmployee(entity) && entity.address?.toLowerCase().startsWith('własne mieszkanie')
                                            ? (entity.ownAddress ? t('entity.ownHousing', { address: entity.ownAddress }) : t('entity.ownHousingNoData'))
                                            : entity.address
                                        }
                                    </TableCell>
                                    <TableCell>{isEmployee(entity) && entity.address?.toLowerCase().startsWith('własne mieszkanie') ? 'N/A' : entity.roomNumber}</TableCell>
                                    <TableCell>{formatDate(entity.checkInDate)}</TableCell>
                                    {isBokTab && <TableCell>{isBokResident(entity) ? entity.passportNumber || '-' : '-'}</TableCell>}
                                    {isBokTab && (
                                        <TableCell className="max-w-[180px]" title={isBokResident(entity) ? entity.comments || '' : undefined}>
                                            <div className="flex flex-col gap-1">
                                                {isPending && (
                                                    <Badge variant="destructive" className="text-[10px] px-1 py-0 w-fit animate-pulse">
                                                        W oczekiwaniu na rozmowę
                                                    </Badge>
                                                )}
                                                <span className="truncate text-xs">{isBokResident(entity) ? entity.comments || '-' : '-'}</span>
                                            </div>
                                        </TableCell>
                                    )}
                                    {isBokTab && <TableCell>{isBokResident(entity) ? (entity.hasPermit ? t('common.yes') : t('common.no')) : '-'}</TableCell>}
                                    {isBokTab && <TableCell>{isBokResident(entity) ? (entity.hasPesel ? t('common.yes') : t('common.no')) : '-'}</TableCell>}
                                    <TableCell>{'checkOutDate' in entity ? formatDate(entity.checkOutDate) : '-'}</TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <EntityActions {...{ entity, onEdit, onRestore, onPermanentDelete, isDismissed }} />
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={12} className="text-center">{t('common.noData')}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
});
EntityTable.displayName = 'EntityTable';

const HistoryTable = ({ history, onSort, sortBy, sortOrder, onDelete, columnFilters, onColumnFilterChange, columnOptions }: { history: AddressHistory[]; onSort: (field: SortableField) => void; sortBy: SortableField | null; sortOrder: 'asc' | 'desc'; onDelete?: (id: string) => void; columnFilters?: Record<string, string[]>; onColumnFilterChange?: (field: string, values: string[]) => void; columnOptions?: Record<string, { label: string, value: string }[]>; }) => {
    const { t } = useLanguage();
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <FilterableHeader label={t('col.lastName')} field="lastName" currentFilterValues={columnFilters?.lastName} onFilterChange={onColumnFilterChange} options={columnOptions?.lastName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.firstName')} field="firstName" currentFilterValues={columnFilters?.firstName} onFilterChange={onColumnFilterChange} options={columnOptions?.firstName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.coordinator')} field="coordinatorName" currentFilterValues={columnFilters?.coordinatorName} onFilterChange={onColumnFilterChange} options={columnOptions?.coordinatorName} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.department')} field="department" currentFilterValues={columnFilters?.department} onFilterChange={onColumnFilterChange} options={columnOptions?.department} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.address')} field="address" currentFilterValues={columnFilters?.address} onFilterChange={onColumnFilterChange} options={columnOptions?.address} onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.checkIn')} field="checkInDate" currentFilterValues={columnFilters?.checkInDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkInDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        <FilterableHeader label={t('col.checkOut')} field="checkOutDate" currentFilterValues={columnFilters?.checkOutDate} onFilterChange={onColumnFilterChange} options={columnOptions?.checkOutDate} isDateFilter onSort={onSort} sortBy={sortBy} sortOrder={sortOrder} />
                        {onDelete && <TableHead><span className="sr-only">{t('col.actions')}</span></TableHead>}
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
                                            <AlertDialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('history.confirmDeleteTitle')}</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {t('history.confirmDeleteDesc', { name: `${entry.employeeFirstName} ${entry.employeeLastName}`.trim(), address: entry.address })}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-destructive hover:bg-destructive/90"
                                                        onClick={() => onDelete(entry.id)}
                                                    >
                                                        {t('entity.confirmDelete')}
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
                            <TableCell colSpan={8} className="text-center">{t('common.noData')}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

const EntityCardList = ({ entities, onEdit, onRestore, isDismissed, settings, onPermanentDelete, bokPendingIds }: { entities: Entity[]; settings: Settings; isDismissed: boolean; onEdit: (e: Entity) => void; onRestore?: (entity: Entity) => void; onPermanentDelete: (id: string, type: 'employee' | 'non-employee' | 'bok-resident') => void; bokPendingIds?: Set<string>; }) => {
    const { t } = useLanguage();
    const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

    return (
        <div className="space-y-4">
            {entities.length > 0 ? (
                entities.map((entity, index) => {
                    const isPending = isBokResident(entity) && bokPendingIds?.has(entity.id);
                    return (
                        <Card
                            key={entity.id}
                            onClick={() => onEdit(entity)}
                            className={cn(
                                'cursor-pointer animate-fade-in-up',
                                isPending && 'animate-blink-red border-red-300'
                            )}
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                            <CardHeader className="flex flex-row items-start justify-between pb-4">
                                <div>
                                    <CardTitle className="text-base">{`${entity.firstName} ${entity.lastName}`.trim()}</CardTitle>
                                    <CardDescription>
                                        {isBokResident(entity) ? t('entity.bokResidentLabel') : (isEmployee(entity) ? getCoordinatorName(entity.coordinatorId) : t('entity.nonEmployeeLabel'))}
                                    </CardDescription>
                                    {isPending && (
                                        <Badge variant="destructive" className="mt-1 text-[10px] px-1 py-0 animate-pulse">
                                            W oczekiwaniu na rozmowę
                                        </Badge>
                                    )}
                                </div>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <EntityActions {...{ entity, onEdit, onRestore, onPermanentDelete, isDismissed }} />
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <p><span className="font-semibold text-muted-foreground">{t('entity.addressLabel')}</span>
                                    {isEmployee(entity) && entity.address?.toLowerCase().startsWith('własne mieszkanie')
                                        ? ` ${entity.ownAddress || t('entity.ownHousingNoData')}`
                                        : ` ${entity.address}, ${t('entity.room')} ${entity.roomNumber}`
                                    }
                                </p>
                                {isEmployee(entity) && <p><span className="font-semibold text-muted-foreground">{t('entity.nationalityLabel')}</span> {entity.nationality || t('common.none')}</p>}
                                <p><span className="font-semibold text-muted-foreground">{t('entity.checkInLabel')}</span> {formatDate(entity.checkInDate)}</p>
                            </CardContent>
                        </Card>
                    );
                })
            ) : (
                <div className="text-center text-muted-foreground py-8">{t('common.noData')}</div>
            )}
        </div>
    )
};

const HistoryCardList = ({ history, onDelete }: { history: AddressHistory[]; onDelete?: (id: string) => void; }) => {
    const { t } = useLanguage();
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
                                        <AlertDialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('history.confirmDeleteTitle')}</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {t('history.confirmDeleteDesc', { name: `${entry.employeeFirstName} ${entry.employeeLastName}`.trim(), address: entry.address })}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-destructive hover:bg-destructive/90"
                                                    onClick={() => onDelete(entry.id)}
                                                >
                                                    {t('entity.confirmDelete')}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p><span className="font-semibold text-muted-foreground">{t('entity.addressLabel')}</span> {entry.address}</p>
                            <p><span className="font-semibold text-muted-foreground">{t('entity.periodLabel')}</span> {formatDate(entry.checkInDate)} - {formatDate(entry.checkOutDate)}</p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center text-muted-foreground py-8">{t('common.noData')}</div>
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
    currentUser,
    settings,
}: {
    search: string;
    onSearch: (value: string) => void;
    onAdd: (type: 'employee' | 'non-employee' | 'bok-resident') => void;
    onViewChange: (mode: 'list' | 'grid') => void;
    viewMode: 'list' | 'grid';
    showAddButton: boolean;
    settings: Settings;
    currentUser: SessionData;
}) => {
    const { t } = useLanguage();
    const { isMobile } = useIsMobile();
    const isCoordinator = settings?.coordinators?.some(c => c.uid === currentUser.uid) ?? false;
    const canAddEmployee = currentUser.isAdmin || isCoordinator;
    const canAddNonEmployee = currentUser.isAdmin || isCoordinator;
    const canAddBokResident = currentUser.isAdmin || currentUser.isDriver || currentUser.isBok;
    const [localSearch, setLocalSearch] = useState(search);
    // Track the last value we committed to the URL ourselves,
    // so we can distinguish our own URL updates from external ones.
    const committedRef = useRef(search);

    useEffect(() => {
        // Only sync URL → input when the change came from outside
        // (e.g. clearing filters), not from our own debounce write.
        if (search !== committedRef.current) {
            setLocalSearch(search);
            committedRef.current = search;
        }
    }, [search]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== search) {
                committedRef.current = localSearch;
                onSearch(localSearch);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch, search, onSearch]);

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>{t('entity.title')}</CardTitle>
            <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">
                <Input
                    placeholder={t('entity.searchBySurname')}
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="w-full sm:w-auto flex-1"
                />
                <div className="flex gap-2">
                    {showAddButton && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size={isMobile ? "icon" : "default"}>
                                    <PlusCircle className={isMobile ? "h-5 w-5" : "mr-2 h-4 w-4"} />
                                    <span className="hidden sm:inline">{t('common.add')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                                {canAddEmployee && <DropdownMenuItem onClick={() => onAdd('employee')}>{t('entity.addEmployee')}</DropdownMenuItem>}
                                {canAddNonEmployee && <DropdownMenuItem onClick={() => onAdd('non-employee')}>{t('entity.addResident')}</DropdownMenuItem>}
                                {canAddBokResident && <DropdownMenuItem onClick={() => onAdd('bok-resident')}>{t('entity.addBokResident')}</DropdownMenuItem>}
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
    const { t } = useLanguage();
    const {
        allEmployees,
        allNonEmployees,
        allBokResidents,
        addressHistory,
        settings,
        odbiorEntries,
        handleRestoreEmployee,
        handleRestoreNonEmployee,
        handleRestoreBokResident,
        handleDeleteEmployee,

        handleEditEmployeeClick,
        handleEditNonEmployeeClick,
        handleEditBokResidentClick,
        handleAddEmployeeClick,
        handleAddNonEmployeeClick,
        handleAddBokResidentClick,
        handleDeleteNonEmployee,
        handleDeleteBokResident,
        handleDeleteAddressHistory,
    } = useMainLayout();

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const { isMobile, isMounted } = useIsMobile();
    const showBokTab = currentUser.isAdmin || currentUser.isBok;
    const defaultTab = currentUser.isBok ? 'bok-residents' : 'active';
    const tabFromUrl = searchParams.get('tab') as 'active' | 'dismissed' | 'non-employees' | 'bok-residents' | 'history' | null;
    const lastTabRef = useRef<'active' | 'dismissed' | 'non-employees' | 'bok-residents' | 'history'>(tabFromUrl || defaultTab);
    if (tabFromUrl) lastTabRef.current = tabFromUrl;
    const tab = tabFromUrl || lastTabRef.current;

    const bokSubTab = (searchParams.get('bokSubTab') as 'active' | 'dismissed') || 'active';
    
    const page = Number(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const viewMode = (searchParams.get('viewMode') as 'list' | 'grid') || (isMobile ? 'grid' : 'list');

    const defaultSortField = useMemo(() => {
        switch (tab) {
            case 'active':
                return 'checkInDate';
            case 'dismissed':
            case 'history':
            case 'non-employees':
                return 'checkOutDate';
            case 'bok-residents':
                return 'checkInDate';
            default:
                return 'lastName';
        }
    }, [tab]);

    const sortBy = (searchParams.get('sortBy') as SortableField) || defaultSortField;
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [drillDownField, setDrillDownField] = useState<'hasPermit' | 'hasPesel' | null>(null);

    const bokPendingIds = useMemo(() => {
        const ids = new Set<string>();
        if (!odbiorEntries) return ids;
        for (const entry of odbiorEntries) {
            if (entry.type === 'zakwaterowanie' && entry.convertedToBokId) {
                ids.add(entry.convertedToBokId);
            }
        }
        return ids;
    }, [odbiorEntries]);

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
        if (!allEmployees || !allNonEmployees || !addressHistory || !settings) return {};

        const getCoordinatorName = (id: string) => settings.coordinators.find(c => c.uid === id)?.name || 'N/A';

        const filterAndSort = <T extends Entity | AddressHistory>(dataToProcess: T[], isHistory: boolean = false): T[] => {
            const filtered = dataToProcess.filter(entity => {
                const q = search.toLowerCase();
                const firstName = ('firstName' in entity && entity.firstName) ? entity.firstName.toLowerCase() : '';
                const lastName = ('lastName' in entity && entity.lastName) ? entity.lastName.toLowerCase() : '';
                const empFirst = (isHistory && 'employeeFirstName' in entity && entity.employeeFirstName) ? entity.employeeFirstName.toLowerCase() : '';
                const empLast = (isHistory && 'employeeLastName' in entity && entity.employeeLastName) ? entity.employeeLastName.toLowerCase() : '';
                const searchMatch = search === '' ||
                    firstName.includes(q) ||
                    lastName.includes(q) ||
                    `${firstName} ${lastName}`.includes(q) ||
                    `${lastName} ${firstName}`.includes(q) ||
                    empFirst.includes(q) ||
                    empLast.includes(q) ||
                    `${empFirst} ${empLast}`.includes(q) ||
                    `${empLast} ${empFirst}`.includes(q);

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
                        } else if (colField === 'hasPermit' || colField === 'hasPesel') {
                            entityVal = String(rawVal === true);
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
        
        const bokResidentsToProcess = allBokResidents || [];
        const filteredBokResidents = filterAndSort(bokResidentsToProcess);
        
        const filteredHistory = filterAndSort(addressHistory, true);

        return {
            activeEmployees: filteredEmployees.filter(e => e.status === 'active'),
            dismissedEmployees: filteredEmployees.filter(e => e.status === 'dismissed'),
            activeNonEmployees: filteredNonEmployees.filter(ne => ne.status !== 'dismissed'),
            dismissedNonEmployees: filteredNonEmployees.filter(ne => ne.status === 'dismissed'),
            activeBokResidents: filteredBokResidents.filter(r => r.status !== "dismissed"),
            dismissedBokResidents: filteredBokResidents.filter(r => r.status === "dismissed"),
            history: filteredHistory,
        }

    }, [allEmployees, allNonEmployees, allBokResidents, addressHistory, settings, search, sortBy, sortOrder, columnFilters]);

    const dataMap = useMemo(() => ({
        active: filteredAndSortedData.activeEmployees || [],
        dismissed: [...(filteredAndSortedData.dismissedEmployees || []), ...(filteredAndSortedData.dismissedNonEmployees || [])],
        'non-employees': filteredAndSortedData.activeNonEmployees || [],
        history: filteredAndSortedData.history || [],
        'bok-residents': [...(filteredAndSortedData.activeBokResidents || []), ...(filteredAndSortedData.dismissedBokResidents || [])],
    }), [filteredAndSortedData]);

    const currentData = dataMap[tab as keyof typeof dataMap];
    const totalPages = Math.ceil((currentData?.length || 0) / ITEMS_PER_PAGE);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return currentData?.slice(start, end) || [];
    }, [currentData, page]);


    const columnOptions = useMemo(() => {
        const options: Record<string, { label: string, value: string }[]> = {};
        const dataToAnalyze = tab === 'history' ? dataMap.history : currentData;

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
            addOptions('hasPermit', item => ('hasPermit' in item) ? String((item as Record<string, unknown>).hasPermit === true) : undefined);
            addOptions('hasPesel', item => ('hasPesel' in item) ? String((item as Record<string, unknown>).hasPesel === true) : undefined);
        }

        options['hasPermit'] = [
            { label: t('common.yes'), value: 'true' },
            { label: t('common.no'), value: 'false' },
        ];
        options['hasPesel'] = [
            { label: t('common.yes'), value: 'true' },
            { label: t('common.no'), value: 'false' },
        ];

        return options;
    }, [tab, dataMap.history, currentData, settings, t]);

    // ─── Excel export ───────────────────────────────────────────────────────
    const getCoordName = useCallback((id: string) =>
        settings?.coordinators.find(c => c.uid === id)?.name || 'N/A',
    [settings]);

    const exportEntities = useCallback((data: Entity[], label: string) => {
        const today = new Date().toISOString().slice(0, 10);
        const rows = data.map(e => {
            const isEmp = isEmployee(e);
            const isBok = isBokResident(e);
            const address = isEmp && e.address?.toLowerCase().startsWith('własne mieszkanie')
                ? `Własne (${e.ownAddress || 'Brak danych'})`
                : e.address || '';
            const room = isEmp && e.address?.toLowerCase().startsWith('własne mieszkanie')
                ? 'N/A'
                : e.roomNumber || '';
            if (isBok) {
                return {
                    'Nazwisko': e.lastName,
                    'Imię': e.firstName,
                    'Narodowość': (e as BokResident).nationality || '',
                    'Płeć': (e as BokResident).gender || '',
                    'Adres': e.address || '',
                    'Pokój': e.roomNumber || '',
                    'Nr paszportu': (e as BokResident).passportNumber || '',
                    'Data zameldowania': formatDate(e.checkInDate),
                    'Data wyjazdu': formatDate((e as BokResident).checkOutDate),
                    'Komentarze': e.comments || '',
                    'Zezwolenie': (e as BokResident).hasPermit ? 'Tak' : 'Brak',
                    'PESEL': (e as BokResident).hasPesel ? 'Tak' : 'Brak',
                };
            }
            const row: Record<string, string | number> = {
                'Nazwisko': e.lastName,
                'Imię': e.firstName,
                'Koordynator': getCoordName(e.coordinatorId),
                'Zakład': isEmp ? (e.zaklad || '') : '',
                'Adres': address,
                'Pokój': room,
                'Data zameldowania': formatDate(e.checkInDate),
                'Data wymeldowania': formatDate(e.checkOutDate),
            };
            if (isEmp) {
                row['Koniec umowy'] = formatDate(e.contractEndDate);
            } else if (!isBok) {
                const ne = e as NonEmployee;
                row['Typ płatności'] = ne.paymentType || '';
                row['Kwota'] = ne.paymentAmount ?? '';
            }
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, label);
        XLSX.writeFile(wb, `${label}_${today}.xlsx`);
    }, [getCoordName]);

    const exportHistory = useCallback((data: AddressHistory[], label: string) => {
        const today = new Date().toISOString().slice(0, 10);
        const rows = data.map(h => ({
            'Nazwisko': h.employeeLastName || '',
            'Imię': h.employeeFirstName || '',
            'Koordynator': h.coordinatorName || 'N/A',
            'Zakład': h.department || '',
            'Adres': h.address || '',
            'Data zameldowania': formatDate(h.checkInDate),
            'Data wymeldowania': formatDate(h.checkOutDate),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, label);
        XLSX.writeFile(wb, `${label}_${today}.xlsx`);
    }, []);

    if (!settings || !allEmployees || !allNonEmployees || !addressHistory) {
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
            await handleRestoreBokResident(entity as BokResident);
        } else if (isEmployee(entity)) {
            await handleRestoreEmployee(entity);
        } else {
            await handleRestoreNonEmployee(entity as NonEmployee);
        }
    };

    const handlePermanentDelete = async (id: string, type: 'employee' | 'non-employee' | 'bok-resident') => {
        if (type === 'bok-resident') {
            await handleDeleteBokResident(id, currentUser.uid);
        } else if (type === 'employee') {
            await handleDeleteEmployee(id, currentUser.uid);
        } else {
            await handleDeleteNonEmployee(id, currentUser.uid);
        }
    };

    const handleEdit = (entity: Entity) => {
        if (isBokResident(entity)) {
            if (currentUser.isAdmin || currentUser.isBok) {
                handleEditBokResidentClick(entity);
            }
            return;
        } else if (isEmployee(entity)) {
            handleEditEmployeeClick(entity);
        } else {
            handleEditNonEmployeeClick(entity as NonEmployee);
        }
    }

    const handleAdd = (type: 'employee' | 'non-employee' | 'bok-resident') => {
        if (type === 'bok-resident') {
            handleAddBokResidentClick();
        } else if (type === 'non-employee') {
            handleAddNonEmployeeClick();
        } else {
            handleAddEmployeeClick();
        }
    }



    const ExportButton = ({ onClick, count }: { onClick: () => void; count: number }) => (
        <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={onClick} disabled={count === 0}>
                <Download className="mr-2 h-4 w-4" />
                {t('entity.exportExcel', { count })}
            </Button>
        </div>
    );

    const renderContent = (data: Entity[], isBokTab: boolean = false, isDismissed: boolean = false, customTotalPages?: number) => (
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
                            isDismissed={isDismissed}
                            isBokTab={isBokTab}
                            onSort={handleSort}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            columnFilters={columnFilters}
                            onColumnFilterChange={handleColumnFilterChange}
                            columnOptions={columnOptions}
                            bokPendingIds={bokPendingIds}
                        /> :
                        <EntityCardList
                            entities={data}
                            settings={settings}
                            onEdit={handleEdit}
                            onRestore={handleRestore}
                            onPermanentDelete={handlePermanentDelete}
                            isDismissed={isDismissed}
                            bokPendingIds={bokPendingIds}
                        />
                    )
                    : <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <PaginationControls currentPage={page} totalPages={customTotalPages ?? totalPages} onPageChange={(p) => updateSearchParams({ page: p })} isDisabled={isPending} />
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

    const desktopTabsList = (
        <TabsList className="hidden sm:flex flex-wrap h-auto w-full justify-start gap-2 bg-transparent p-0">
            {showBokTab && (
                <TabsTrigger value="bok-residents" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                    <Briefcase className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{t('tab.bok')} ({(filteredAndSortedData.activeBokResidents || []).length})</span>
                </TabsTrigger>
            )}
            <TabsTrigger value="active" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                <Users className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{t('tab.active')} ({dataMap.active.length})</span>
            </TabsTrigger>
            <TabsTrigger value="dismissed" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                <UserX className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{t('tab.dismissed')} ({dataMap.dismissed.length})</span>
            </TabsTrigger>
            <TabsTrigger value="non-employees" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                <UserX className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{t('tab.nonEmployees')} ({dataMap['non-employees'].length})</span>
            </TabsTrigger>
            <TabsTrigger value="history" disabled={isPending} className="flex-1 min-w-[120px] bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4 py-2 hover:bg-muted/80">
                <History className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{t('tab.history')} ({dataMap.history.length})</span>
            </TabsTrigger>
        </TabsList>
    );

    const mobileTabSelect = (
        <div className="block sm:hidden mb-6">
            <Select value={tab} onValueChange={(v) => updateSearchParams({ tab: v, page: 1 })} disabled={isPending}>
                <SelectTrigger className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {showBokTab && (
                        <SelectItem value="bok-residents">
                            {t('tab.bok')} ({(filteredAndSortedData.activeBokResidents || []).length})
                        </SelectItem>
                    )}
                    <SelectItem value="active">{t('tab.active')} ({dataMap.active.length})</SelectItem>
                    <SelectItem value="dismissed">{t('tab.dismissed')} ({dataMap.dismissed.length})</SelectItem>
                    <SelectItem value="non-employees">{t('tab.nonEmployees')} ({dataMap['non-employees'].length})</SelectItem>
                    <SelectItem value="history">{t('tab.history')} ({dataMap.history.length})</SelectItem>
                </SelectContent>
            </Select>
        </div>
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
                    currentUser={currentUser}
                    settings={settings}
                />
            </CardHeader>
            <CardContent>
                <Tabs value={tab} onValueChange={(v) => updateSearchParams({ tab: v, page: 1 })}>
                    <div className="w-full mb-6 relative">
                        {desktopTabsList}
                        {mobileTabSelect}
                    </div>
                    <TabsContent forceMount value="active" className="mt-4 data-[state=inactive]:hidden">
                        <ExportButton count={dataMap.active.length} onClick={() => exportEntities(dataMap.active, 'Pracownicy_Aktywni')} />
                        {viewMode === 'grid' && columnOptions?.zaklad && columnOptions.zaklad.length > 0 && (
                            <div className="mb-3">
                                <Select
                                    value={columnFilters.zaklad?.[0] || '_all'}
                                    onValueChange={(val) => handleColumnFilterChange('zaklad', val === '_all' ? [] : [val])}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t('entity.filterByDepartment')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_all">{t('entity.allDepartments')}</SelectItem>
                                        {columnOptions.zaklad.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {renderContent(paginatedData as Entity[], false, false)}
                    </TabsContent>
                    <TabsContent forceMount value="dismissed" className="mt-4 data-[state=inactive]:hidden">
                        <ExportButton count={dataMap.dismissed.length} onClick={() => exportEntities(dataMap.dismissed, 'Pracownicy_Zwolnieni')} />
                        {renderContent(paginatedData as Entity[], false, true)}
                    </TabsContent>
                    <TabsContent forceMount value="non-employees" className="mt-4 data-[state=inactive]:hidden">
                        <ExportButton count={dataMap['non-employees'].length} onClick={() => exportEntities(dataMap['non-employees'], 'Mieszkancy_NZ')} />
                        {renderContent(paginatedData as Entity[], false, false)}
                    </TabsContent>
                    <TabsContent forceMount value="history" className="mt-4 data-[state=inactive]:hidden">
                        <ExportButton count={dataMap.history.length} onClick={() => exportHistory(dataMap.history as AddressHistory[], 'Historia_Adresow')} />
                        {renderHistoryContent()}
                    </TabsContent>
                    {showBokTab && (
                        <TabsContent forceMount value="bok-residents" className="mt-4 data-[state=inactive]:hidden">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-4">
                                {isMobile ? (
                                    <Select value={bokSubTab} onValueChange={(v) => updateSearchParams({ bokSubTab: v, page: 1 })}>
                                        <SelectTrigger className="w-full sm:w-auto">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">{t('tab.bokActive')} ({(filteredAndSortedData.activeBokResidents || []).length})</SelectItem>
                                            <SelectItem value="dismissed">{t('tab.bokDismissed')} ({(filteredAndSortedData.dismissedBokResidents || []).length})</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button variant={bokSubTab === 'active' ? 'secondary' : 'ghost'} size="sm" onClick={() => updateSearchParams({ bokSubTab: 'active', page: 1 })}>
                                            {t('tab.bokActive')} ({(filteredAndSortedData.activeBokResidents || []).length})
                                        </Button>
                                        <Button variant={bokSubTab === 'dismissed' ? 'secondary' : 'ghost'} size="sm" onClick={() => updateSearchParams({ bokSubTab: 'dismissed', page: 1 })}>
                                            {t('tab.bokDismissed')} ({(filteredAndSortedData.dismissedBokResidents || []).length})
                                        </Button>
                                    </div>
                                )}
                                <ExportButton count={(bokSubTab === 'active' ? (filteredAndSortedData.activeBokResidents || []).length : (filteredAndSortedData.dismissedBokResidents || []).length)} onClick={() => exportEntities(bokSubTab === 'active' ? (filteredAndSortedData.activeBokResidents || []) : (filteredAndSortedData.dismissedBokResidents || []), bokSubTab === 'active' ? 'BOK_Aktywni' : 'BOK_Zwolnieni')} />
                            </div>
                            {(() => {
                                const bokData = bokSubTab === 'active' ? (filteredAndSortedData.activeBokResidents || []) : (filteredAndSortedData.dismissedBokResidents || []);
                                const bokTotalPages = Math.ceil(bokData.length / ITEMS_PER_PAGE);
                                const bokPaginated = bokData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
                                const permitYesList = bokData.filter((r: Entity) => isBokResident(r) && r.hasPermit) as BokResident[];
                                const permitNoList = bokData.filter((r: Entity) => isBokResident(r) && !r.hasPermit) as BokResident[];
                                const peselYesList = bokData.filter((r: Entity) => isBokResident(r) && r.hasPesel) as BokResident[];
                                const peselNoList = bokData.filter((r: Entity) => isBokResident(r) && !r.hasPesel) as BokResident[];
                                const stats = {
                                    permitYes: permitYesList.length,
                                    permitNo: permitNoList.length,
                                    peselYes: peselYesList.length,
                                    peselNo: peselNoList.length,
                                };
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <Card
                                                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                                                onClick={() => setDrillDownField('hasPermit')}
                                            >
                                                <p className="text-xs text-muted-foreground mb-1">{t('stats.hasPermit')}</p>
                                                <div className="flex gap-3 text-sm">
                                                    <span className="font-medium">{t('stats.yes')}: <span className="text-green-700">{stats.permitYes}</span></span>
                                                    <span className="font-medium">{t('stats.no')}: <span className="text-red-600">{stats.permitNo}</span></span>
                                                </div>
                                            </Card>
                                            <Card
                                                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                                                onClick={() => setDrillDownField('hasPesel')}
                                            >
                                                <p className="text-xs text-muted-foreground mb-1">{t('stats.hasPesel')}</p>
                                                <div className="flex gap-3 text-sm">
                                                    <span className="font-medium">{t('stats.yes')}: <span className="text-green-700">{stats.peselYes}</span></span>
                                                    <span className="font-medium">{t('stats.no')}: <span className="text-red-600">{stats.peselNo}</span></span>
                                                </div>
                                            </Card>
                                        </div>
                                        <BokStatsDrillDownDialog
                                            isOpen={drillDownField === 'hasPermit'}
                                            onOpenChange={(open) => { if (!open) setDrillDownField(null); }}
                                            title={t('stats.hasPermit')}
                                            yesLabel={t('stats.yes')}
                                            noLabel={t('stats.no')}
                                            yesList={permitYesList}
                                            noList={permitNoList}
                                        />
                                        <BokStatsDrillDownDialog
                                            isOpen={drillDownField === 'hasPesel'}
                                            onOpenChange={(open) => { if (!open) setDrillDownField(null); }}
                                            title={t('stats.hasPesel')}
                                            yesLabel={t('stats.yes')}
                                            noLabel={t('stats.no')}
                                            yesList={peselYesList}
                                            noList={peselNoList}
                                        />
                                        {renderContent(bokPaginated, true, bokSubTab === 'dismissed', bokTotalPages)}
                                    </>
                                );
                            })()}
                        </TabsContent>
                    )}
                </Tabs>
            </CardContent>
        </Card>
    )
}

